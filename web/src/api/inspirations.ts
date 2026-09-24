import { api, apiRequest } from './client';

export interface InspirationAttachment {
  id: string;
  inspirationId: string;
  kind: 'image' | 'audio' | 'video';
  mimeType: string;
  originalName?: string | null;
  caption?: string | null;
  sizeBytes: number;
  transcript?: string | null;
  aiSummary?: string | null;
  createdAt: string;
}

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
  focusSessionId?: string | null;
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
  attachments?: InspirationAttachment[];
}

export interface ReviewQueue {
  total: number;
  items: InspirationRecord[];
}

export interface ReviewBatchItem {
  id: string;
  batchId: string;
  inspirationId: string;
  ordinal: number;
  state: 'pending' | 'reflected' | 'later' | 'digested';
  processedAt?: string | null;
  processedRequestId?: string | null;
  resultReflectionId?: string | null;
  inspiration: InspirationRecord;
}

export interface TodayReviewBatch {
  id: string;
  localDate: string;
  timeZone: string;
  total: number;
  pending: number;
  items: ReviewBatchItem[];
}

export interface InspirationWallLayout {
  id: string;
  userId: string;
  inspirationId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  color: string;
  rotation: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
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

export function listInspirationsForDay(start: string, end: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ from: start, to: end });
  return api.get<InspirationRecord[]>(`/inspirations?${query.toString()}`, {
    fallback: [],
    throwOnError: true,
    signal,
  });
}

export function createInspiration(contentText: string, tags: string[] = []) {
  return api.post<InspirationRecord>('/inspirations', {
    sourceType: 'manual',
    contentText,
    tags,
  }, { throwOnError: true });
}


export function createMultimodalInspiration(
  contentText: string,
  files: File[] = [],
  tags: string[] = [],
  options: { requestId?: string; timeZone?: string; focusSessionId?: string } = {},
) {
  const form = new FormData();
  if (contentText.trim()) form.append('contentText', contentText.trim());
  form.append('tags', JSON.stringify(tags));
  form.append('requestId', options.requestId || crypto.randomUUID());
  form.append('timeZone', options.timeZone || currentTimeZone());
  if (options.focusSessionId) form.append('focusSessionId', options.focusSessionId);
  files.forEach((file) => form.append('files', file, file.name));
  return api.post<InspirationRecord>(
    '/inspirations/capture',
    form,
    { throwOnError: true, timeoutMs: 90_000 },
  );
}

export async function fetchInspirationAttachmentBlob(
  inspirationId: string,
  attachmentId: string,
) {
  const response = await apiRequest(
    `/inspirations/${encodeURIComponent(inspirationId)}/attachments/${encodeURIComponent(attachmentId)}/file`,
    { timeoutMs: 90_000 },
  );
  return response.blob();
}

export function addInspirationAttachments(id: string, files: File[]) {
  const form = new FormData();
  files.forEach((file) => form.append('files', file, file.name));
  return api.post<InspirationRecord>(`/inspirations/${encodeURIComponent(id)}/attachments`, form, {
    throwOnError: true, timeoutMs: 90_000,
  });
}

export function deleteInspirationAttachment(id: string, attachmentId: string) {
  return api.delete<InspirationRecord>(
    `/inspirations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    { throwOnError: true },
  );
}

export function updateInspirationAttachmentCaption(id: string, attachmentId: string, caption: string) {
  return patchJson<InspirationAttachment>(
    `/inspirations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
    { caption },
  );
}

export function transcribeInspirationAttachment(
  inspirationId: string,
  attachmentId: string,
) {
  return api.post<InspirationAttachment>(
    `/inspirations/${encodeURIComponent(inspirationId)}/attachments/${encodeURIComponent(attachmentId)}/transcribe`,
    {},
    { throwOnError: true, timeoutMs: 75_000 },
  );
}

export function summarizeInspirationAttachment(
  inspirationId: string,
  attachmentId: string,
) {
  return api.post<InspirationAttachment>(
    `/inspirations/${encodeURIComponent(inspirationId)}/attachments/${encodeURIComponent(attachmentId)}/summary`,
    {},
    { throwOnError: true, timeoutMs: 75_000 },
  );
}


export function analyzeInspirationAttachment(
  inspirationId: string,
  attachmentId: string,
) {
  return api.post<InspirationAttachment>(
    `/inspirations/${encodeURIComponent(inspirationId)}/attachments/${encodeURIComponent(attachmentId)}/analyze`,
    {},
    { throwOnError: true, timeoutMs: 105_000 },
  );
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

export function getTodayReviewBatch() {
  const timeZone = encodeURIComponent(currentTimeZone());
  return api.get<TodayReviewBatch>(`/inspirations/review/today?timeZone=${timeZone}`, {
    fallback: { id: '', localDate: '', timeZone: currentTimeZone(), total: 0, pending: 0, items: [] },
    throwOnError: true,
  });
}

export function extendTodayReviewBatch() {
  return api.post<TodayReviewBatch>('/inspirations/review/today/more', {
    timeZone: currentTimeZone(),
  }, { throwOnError: true });
}

export function processReviewBatchItem(
  itemId: string,
  action: 'reflection' | 'later' | 'digested',
  options: { requestId: string; body?: string },
) {
  return api.post<ReviewBatchItem>(
    `/inspirations/review/items/${encodeURIComponent(itemId)}/process`,
    { action, requestId: options.requestId, body: options.body },
    { throwOnError: true },
  );
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

export function listInspirationWallLayouts() {
  return api.get<InspirationWallLayout[]>('/inspirations/wall/layouts', {
    fallback: [],
    throwOnError: true,
  });
}

export function saveInspirationWallLayout(
  inspirationId: string,
  layout: Pick<InspirationWallLayout, 'x' | 'y' | 'width' | 'height' | 'z' | 'color' | 'rotation'> & { expectedVersion: number },
) {
  return patchJson<InspirationWallLayout>(
    `/inspirations/wall/${encodeURIComponent(inspirationId)}`,
    layout,
  );
}
