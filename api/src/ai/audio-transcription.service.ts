import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const MAX_TRANSCRIPTION_AUDIO_BYTES = 7 * 1024 * 1024;
const TRANSCRIBE_TIMEOUT_MS = 60_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
]);

export interface AudioTranscriptionInput {
  buffer?: Buffer;
  size?: number;
  mimetype?: string;
}

export function validateAudioInput(file: AudioTranscriptionInput) {
  const size = file.size ?? file.buffer?.length ?? 0;
  const mimetype = (file.mimetype || '').toLowerCase().split(';')[0];

  if (!file.buffer?.length || size <= 0) {
    throw new BadRequestException('音频内容为空');
  }
  if (size > MAX_TRANSCRIPTION_AUDIO_BYTES) {
    throw new BadRequestException('音频超过当前转写上限（7MB）');
  }
  if (!SUPPORTED_AUDIO_TYPES.has(mimetype)) {
    throw new BadRequestException('当前音频格式暂不支持转写');
  }
  return { size, mimetype };
}

@Injectable()
export class AudioTranscriptionService {
  constructor(private readonly config: ConfigService) {}

  private apiKey() {
    return (
      this.config.get<string>('STT_API_KEY')?.trim()
      || this.config.get<string>('AI_API_KEY')?.trim()
      || ''
    );
  }

  private baseUrl() {
    return (
      this.config.get<string>('STT_BASE_URL')?.trim()
      || this.config.get<string>('AI_BASE_URL')?.trim()
      || ''
    ).replace(/\/+$/, '');
  }

  private model() {
    return this.config.get<string>('STT_MODEL')?.trim() || 'qwen3-asr-flash';
  }

  isConfigured() {
    return Boolean(this.apiKey() && this.baseUrl());
  }

  status() {
    return {
      configured: this.isConfigured(),
      model: this.isConfigured() ? this.model() : null,
    };
  }

  async transcribe(file?: AudioTranscriptionInput) {
    if (!file) throw new BadRequestException('Audio file is required');
    const { mimetype, size } = validateAudioInput(file);
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('Voice transcription is not configured');
    }

    const dataUrl = `data:${mimetype};base64,${file.buffer!.toString('base64')}`;
    if (Buffer.byteLength(dataUrl, 'utf8') > 10 * 1024 * 1024) {
      throw new BadRequestException('Encoded audio exceeds transcription limit');
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey()}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
        body: JSON.stringify({
          model: this.model(),
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_audio',
                  input_audio: { data: dataUrl },
                },
              ],
            },
          ],
          stream: false,
          asr_options: {
            enable_itn: true,
          },
        }),
      });
    } catch {
      throw new ServiceUnavailableException('Voice transcription request failed');
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Voice transcription failed (${response.status})`,
      );
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException('Voice transcription returned no text');
    }

    return {
      text: content.trim().slice(0, 12_000),
      model: this.model(),
      bytes: size,
    };
  }
}
