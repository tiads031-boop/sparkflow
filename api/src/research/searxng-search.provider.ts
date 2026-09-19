import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SearchProvider, SearchRequest, SearchResult } from './search-provider';

const SEARCH_TIMEOUT_MS = 12_000;

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

@Injectable()
export class SearxngSearchProvider implements SearchProvider {
  readonly providerName = 'searxng';

  constructor(private readonly config: ConfigService) {}

  private baseUrl() {
    return (this.config.get<string>('SEARXNG_BASE_URL') || '')
      .trim()
      .replace(/\/+$/, '');
  }

  isConfigured() {
    return Boolean(this.baseUrl());
  }

  async search(request: SearchRequest): Promise<SearchResult[]> {
    const baseUrl = this.baseUrl();
    if (!baseUrl) return [];

    const limit = Math.max(1, Math.min(request.limit || 5, 8));
    const params = new URLSearchParams({
      q: request.query,
      format: 'json',
      language: 'auto',
      safesearch: '1',
    });

    const response = await fetch(`${baseUrl}/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`SearXNG search failed (${response.status})`);
    }

    const payload = await response.json() as {
      results?: Array<{
        title?: unknown;
        url?: unknown;
        content?: unknown;
        publishedDate?: unknown;
        engine?: unknown;
      }>;
    };

    if (!Array.isArray(payload.results)) return [];

    return payload.results.slice(0, limit * 2).flatMap((item) => {
      const url = safeHttpUrl(item.url);
      if (!url) return [];
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      const snippet = typeof item.content === 'string' ? item.content.trim() : '';
      if (!title && !snippet) return [];
      return [{
        title: title.slice(0, 500) || new URL(url).hostname,
        url,
        snippet: snippet.slice(0, 1600),
        publishedAt: typeof item.publishedDate === 'string' ? item.publishedDate : null,
        engine: typeof item.engine === 'string' ? item.engine : null,
      }];
    }).slice(0, limit);
  }
}
