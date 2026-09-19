import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAX_MEDIA_AI_BYTES = 12 * 1024 * 1024;
const MEDIA_TIMEOUT_MS = 90_000;

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

function normalizedMime(value: string) {
  return value.trim().toLowerCase().split(';')[0];
}

function dataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const candidates = [
    trimmed,
    trimmed.match(/\`\`\`(?:json)?\s*([\s\S]*?)\`\`\`/i)?.[1]?.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Fall through to the first-object extraction below.
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error('Media model returned invalid JSON');
}

function streamText(raw: string) {
  let result = '';
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: unknown } }>;
      };
      const content = parsed.choices?.[0]?.delta?.content;
      if (typeof content === 'string') result += content;
    } catch {
      // Ignore malformed SSE keepalive/chunks; valid content chunks still accumulate.
    }
  }
  return result.trim();
}

@Injectable()
export class MediaUnderstandingService {
  constructor(private readonly config: ConfigService) {}

  private apiKey() {
    return (
      this.config.get<string>('MEDIA_AI_API_KEY')?.trim()
      || this.config.get<string>('AI_API_KEY')?.trim()
      || ''
    );
  }

  private baseUrl() {
    return (
      this.config.get<string>('MEDIA_AI_BASE_URL')?.trim()
      || this.config.get<string>('AI_BASE_URL')?.trim()
      || ''
    ).replace(/\/+$/, '');
  }

  private imageModel() {
    return (
      this.config.get<string>('MEDIA_IMAGE_MODEL')?.trim()
      || this.config.get<string>('AI_MODEL')?.trim()
      || 'qwen3-vl-plus'
    );
  }

  private videoModel() {
    return this.config.get<string>('MEDIA_VIDEO_MODEL')?.trim()
      || 'qwen3.8-omni-flash';
  }

  isConfigured() {
    return Boolean(this.apiKey() && this.baseUrl());
  }

  private validateBuffer(
    buffer: Buffer,
    mimeType: string,
    allowed: Set<string>,
  ) {
    const mime = normalizedMime(mimeType);
    if (!buffer.length) throw new BadRequestException('Attachment is empty');
    if (buffer.length > MAX_MEDIA_AI_BYTES) {
      throw new BadRequestException('Attachment is too large for AI analysis');
    }
    if (!allowed.has(mime)) {
      throw new BadRequestException('Attachment format is not supported for AI analysis');
    }
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Media AI is not configured');
    }
    return mime;
  }

  async analyzeImage(
    buffer: Buffer,
    mimeType: string,
    context = '',
  ): Promise<{ summary: string; model: string }> {
    const mime = this.validateBuffer(buffer, mimeType, IMAGE_MIME_TYPES);
    const requestBody = {
      model: this.imageModel(),
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: [
            'Analyze a user-owned image saved as a personal capture.',
            'Extract visible text when useful, then summarize the important information.',
            'Preserve concrete names, dates, numbers, decisions, questions, and action ideas.',
            'Do not invent text or facts that are not visible or strongly supported by the image.',
            'If something is unclear, say it is unclear instead of guessing.',
            'Use the same language as the visible text or provided context when practical.',
            'Return only a concise review-ready summary, with no preamble.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: dataUrl(buffer, mime) },
            },
            {
              type: 'text',
              text: context.trim().slice(0, 1000)
                || '提取这张图片中值得以后回顾的信息。',
            },
          ],
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      });
    } catch {
      throw new ServiceUnavailableException('Image AI request failed');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`Image AI failed (${response.status})`);
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const summary = payload.choices?.[0]?.message?.content;
    if (typeof summary !== 'string' || !summary.trim()) {
      throw new ServiceUnavailableException('Image AI returned no summary');
    }

    return {
      summary: summary.trim().slice(0, 6000),
      model: this.imageModel(),
    };
  }

  async analyzeVideo(
    buffer: Buffer,
    mimeType: string,
    context = '',
  ): Promise<{ transcript: string | null; summary: string; model: string }> {
    const mime = this.validateBuffer(buffer, mimeType, VIDEO_MIME_TYPES);
    const requestBody = {
      model: this.videoModel(),
      stream: true,
      messages: [
        {
          role: 'system',
          content: [
            'Analyze a user-owned short video saved as a personal capture.',
            'Use both visible content and audible speech when the model can perceive them.',
            'Return JSON only: {"transcript":"...","summary":"..."}.',
            'transcript must contain only intelligible spoken words, in order; use an empty string when there is no intelligible speech.',
            'summary must combine the important visual and spoken information into a concise review-ready note.',
            'Preserve concrete names, dates, numbers, decisions, questions, and action ideas.',
            'Do not invent speech, visual text, or facts. Mark uncertainty in the summary instead of guessing.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: {
                url: dataUrl(buffer, mime),
                fps: 1,
              },
            },
            {
              type: 'text',
              text: context.trim().slice(0, 1000)
                || '转写可听见的语音，并总结这段视频中值得以后回顾的信息。',
            },
          ],
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      });
    } catch {
      throw new ServiceUnavailableException('Video AI request failed');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(`Video AI failed (${response.status})`);
    }

    const streamed = streamText(await response.text());
    if (!streamed) {
      throw new ServiceUnavailableException('Video AI returned no result');
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = extractJsonObject(streamed);
    } catch {
      throw new ServiceUnavailableException('Video AI returned an invalid result');
    }
    const transcript = typeof parsed.transcript === 'string'
      ? parsed.transcript.trim().slice(0, 10000)
      : '';
    const summary = typeof parsed.summary === 'string'
      ? parsed.summary.trim().slice(0, 6000)
      : '';
    if (!summary) {
      throw new ServiceUnavailableException('Video AI returned no summary');
    }

    return {
      transcript: transcript || null,
      summary,
      model: this.videoModel(),
    };
  }
}
