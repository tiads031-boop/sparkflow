import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AIProvider,
  GeneratedInsight,
  InsightGenerationInput,
  InsightType,
} from './ai-provider';

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced.trim());
      } catch {
        // Fall through to the first-object fallback below.
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('AI provider returned invalid JSON');
  }
}

function toGeneratedInsights(value: unknown): GeneratedInsight[] {
  if (!value || typeof value !== 'object') return [];
  const items = (value as { insights?: unknown }).insights;
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const type = candidate.type;
    if (!['theme', 'evolution', 'action'].includes(String(type))) return [];
    if (typeof candidate.title !== 'string' || typeof candidate.body !== 'string') return [];
    if (!Array.isArray(candidate.sourceIds)) return [];
    return [{
      title: candidate.title,
      body: candidate.body,
      type: type as InsightType,
      sourceIds: candidate.sourceIds.filter((id): id is string => typeof id === 'string'),
    }];
  });
}

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly config: ConfigService) {}

  private providerName() {
    return (this.config.get<string>('AI_PROVIDER') || 'openai').trim().toLowerCase();
  }

  private apiKey() {
    const explicit = this.config.get<string>('AI_API_KEY')?.trim();
    if (explicit) return explicit;
    if (this.providerName() === 'deepseek') return this.config.get<string>('DEEPSEEK_API_KEY')?.trim() || '';
    return this.config.get<string>('OPENAI_API_KEY')?.trim() || '';
  }

  private baseUrl() {
    const explicit = this.config.get<string>('AI_BASE_URL')?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    return this.providerName() === 'deepseek'
      ? 'https://api.deepseek.com'
      : 'https://api.openai.com/v1';
  }

  get modelName() {
    const explicit = this.config.get<string>('AI_MODEL')?.trim();
    if (explicit) return explicit;
    return this.providerName() === 'deepseek' ? 'deepseek-chat' : 'gpt-4.1-mini';
  }

  async generateInsights(input: InsightGenerationInput): Promise<GeneratedInsight[]> {
    const key = this.apiKey();
    if (!key) throw new Error('AI provider is not configured');

    const response = await fetch(`${this.baseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.25,
        messages: [
          {
            role: 'system',
            content: [
              'You synthesize personal notes into explainable insights.',
              'Return one JSON object only: {"insights":[...]}.',
              'Each insight must use type theme, evolution, or action.',
              'Every insight must cite at least two sourceIds copied exactly from the provided records.',
              'Never invent ids, facts, people, dates, or conclusions not supported by the records.',
              'theme = a recurring principle/problem/direction; evolution = a meaningful change over time; action = a concrete opportunity supported by repeated notes.',
              'Write title and body in the dominant language of the user records.',
              'Prefer 1-4 strong insights. If evidence is weak, return {"insights":[]}.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({ records: input.records }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI provider request failed (${response.status})`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned an empty response');
    return toGeneratedInsights(extractJsonObject(content));
  }
}
