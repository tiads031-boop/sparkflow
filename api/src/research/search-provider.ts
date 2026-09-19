export interface SearchRequest {
  query: string;
  limit?: number;
  preferOfficial?: boolean;
  highImpact?: boolean;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string | null;
  engine?: string | null;
}

export interface SearchProvider {
  readonly providerName: string;
  isConfigured(): boolean;
  search(request: SearchRequest): Promise<SearchResult[]>;
}

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');
