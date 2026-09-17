import { api, apiRequest } from './client';

export type InsightType = 'theme' | 'evolution' | 'action';

export interface InsightSourceRecord {
  id: string;
  title?: string | null;
  description?: string | null;
  contentText?: string | null;
  sourceType: string;
  tags: string[];
  createdAt: string;
}

export interface InsightRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: InsightType;
  status: 'active' | 'archived';
  aiModel?: string | null;
  createdAt: string;
  updatedAt: string;
  sources: Array<{
    insightId: string;
    inspirationId: string;
    inspiration: InsightSourceRecord;
  }>;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await apiRequest(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export function listInsights(status: 'active' | 'archived' = 'active') {
  return api.get<InsightRecord[]>(`/insights?status=${status}`, {
    fallback: [],
    throwOnError: true,
  });
}

export function generateInsights(days = 30) {
  return api.post<InsightRecord[]>('/insights/generate', { days }, {
    throwOnError: true,
  });
}

export function archiveInsight(id: string) {
  return patchJson<InsightRecord>(`/insights/${encodeURIComponent(id)}/status`, {
    status: 'archived',
  });
}

export function deleteInsight(id: string) {
  return api.delete<InsightRecord>(`/insights/${encodeURIComponent(id)}`, {
    throwOnError: true,
  });
}
