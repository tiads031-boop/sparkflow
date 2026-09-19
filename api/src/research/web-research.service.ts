import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type {
  PlanningEvidenceItem,
  PlanningResearchRequest,
} from '../ai/ai-provider';
import {
  SEARCH_PROVIDER,
  type SearchProvider,
} from './search-provider';

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function classifySource(domain: string): PlanningEvidenceItem['sourceType'] {
  if (!domain) return 'unknown';
  if (
    /(^|\.)gov(\.[a-z]{2})?$/.test(domain) ||
    /(^|\.)gov\.cn$/.test(domain) ||
    /(^|\.)edu(\.[a-z]{2})?$/.test(domain) ||
    /(^|\.)edu\.cn$/.test(domain) ||
    /(^|\.)ac\.jp$/.test(domain)
  ) return 'official';

  if (
    domain === 'reddit.com' ||
    domain.endsWith('.reddit.com') ||
    domain === 'zhihu.com' ||
    domain.endsWith('.zhihu.com') ||
    domain === 'x.com' ||
    domain === 'twitter.com'
  ) return 'community';

  return 'unknown';
}

function evidenceId(query: string, url: string) {
  return createHash('sha256').update(`${query}\n${url}`).digest('hex').slice(0, 24);
}

@Injectable()
export class WebResearchService {
  constructor(
    @Inject(SEARCH_PROVIDER) private readonly searchProvider: SearchProvider,
  ) {}

  isConfigured() {
    return this.searchProvider.isConfigured();
  }

  get providerName() {
    return this.searchProvider.providerName;
  }

  async research(requests: PlanningResearchRequest[]): Promise<PlanningEvidenceItem[]> {
    if (!this.isConfigured()) return [];

    const uniqueQueries = new Map<string, PlanningResearchRequest>();
    for (const request of requests.slice(0, 3)) {
      const query = request.query.trim();
      if (!query) continue;
      uniqueQueries.set(query.toLowerCase(), { ...request, query });
    }

    const fetchedAt = new Date();
    const evidence: PlanningEvidenceItem[] = [];
    const seenUrls = new Set<string>();

    for (const request of uniqueQueries.values()) {
      const results = await this.searchProvider.search({
        query: request.query,
        limit: request.highImpact ? 6 : 4,
        preferOfficial: request.preferOfficial,
        highImpact: request.highImpact,
      });

      for (const result of results) {
        if (seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);
        const domain = domainFromUrl(result.url);
        evidence.push({
          id: evidenceId(request.query, result.url),
          query: request.query,
          title: result.title,
          url: result.url,
          domain,
          snippet: result.snippet,
          sourceType: classifySource(domain),
          fetchedAt: fetchedAt.toISOString(),
          expiresAt: new Date(
            fetchedAt.getTime() + (request.highImpact ? 24 : 7 * 24) * 60 * 60 * 1000,
          ).toISOString(),
          highImpact: request.highImpact,
        });
      }
    }

    return evidence.slice(0, 18);
  }
}
