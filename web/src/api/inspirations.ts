import { api, apiRequest } from './client';

export interface InspirationReflection {
  id: string;
  userId: string;
  inspirationId: string;
  body: string;
  createdAt: string;
}

export interface InspirationRecord {
  id: string;
  userId: string;
  sourceUrl?: string | null;
  sourceType: string;
  title?: string | null;
  description?: string | null;
  contentText?: string | null;
  tags: string[];
  status: string;
  reviewState: string;
  nextReviewAt?: string | null;
  lastReviewedAt?: string | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  reflections?: InspirationReflection[];
  _count?: { reflections: number };
  task?: { id: string; title: string; status: string } | null;
}

export interface ReviewQueue {
  total: number;
  items: InspirationRecord[];
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const response = await apiRequest(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return response.json() as Promise<T>;
}

export function listInspirations() {
  return api.get<InspirationRecord[]>('/inspirations?status=active', {
    fallback: [],
    throwOnError: true,
  });
}

export function createInspiration(contentText: string, tags: string[] = []) {
  return api.post<InspirationRecord>('/inspirations', {
    sourceType: 'manual',
    contentText,
    tags,
  }, { throwOnError: true });
}

export function updateInspiration(id: string, data: Partial<Pick<InspirationRecord, 'title' | 'description' | 'contentText' | 'sourceUrl' | 'sourceType' | 'tags'>>) {
  return patchJson<InspirationRecord>(`/inspirations/${encodeURIComponent(id)}`, data);
}

export function deleteInspiration(id: string) {
  return api.delete<InspirationRecord>(`/inspirations/${encodeURIComponent(id)}`, {
    throwOnError: true,
  });
}

export function getReviewQueue(limit = 5) {
  return api.get<ReviewQueue>(`/inspirations/review/queue?limit=${limit}`, {
    fallback: { total: 0, items: [] },
    throwOnError: true,
  });
}

export function addReflection(id: string, body: string) {
  return api.post<InspirationRecord>(`/inspirations/${encodeURIComponent(id)}/reflections`, { body }, {
    throwOnError: true,
  });
}

export function applyReviewAction(id: string, action: 'later' | 'digested') {
  return patchJson<InspirationRecord>(`/inspirations/${encodeURIComponent(id)}/review`, { action });
}

export function createTaskFromInspiration(id: string) {
  return api.post<{ id: string; title: string; inspirationId: string }>(
    `/inspirations/${encodeURIComponent(id)}/task`,
    {},
    { throwOnError: true },
  );
}
