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

export interface InsightActionTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
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
  tasks?: InsightActionTask[];
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
    timeoutMs: 75_000,
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


export interface CreateInsightTaskInput {
  title: string;
  description?: string;
  estimatedMinutes?: number;
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
}

function localDateEndToIso(value?: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

export async function createTaskFromInsight(insightId: string, input: CreateInsightTaskInput) {
  const response = await apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description?.trim() || undefined,
      status: 'todo',
      priority: input.priority || 'medium',
      section: 'personal',
      estimatedMinutes: input.estimatedMinutes,
      dueDate: localDateEndToIso(input.dueDate),
      insightId,
      tags: [],
    }),
  });
  return response.json() as Promise<InsightActionTask>;
}


export type InsightCadence = 'weekly' | 'interval';

export interface InsightSchedulePreferences {
  enabled: boolean;
  cadence: InsightCadence;
  weekDay: number;
  hour: number;
  minute: number;
  intervalDays: number;
  timeZone: string;
  anchorDate: string;
}

export type InsightRunStatus = 'queued' | 'running' | 'completed' | 'skipped' | 'failed';

export interface InsightGenerationRun {
  id: string;
  runKey: string;
  trigger: 'automatic' | 'regenerate';
  cadence: InsightCadence;
  timeZone: string;
  periodStart: string;
  periodEnd: string;
  scheduledFor: string;
  status: InsightRunStatus;
  sourceCount: number;
  insightCount: number;
  retryCount: number;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  insights: Array<Pick<InsightRecord, 'id' | 'title' | 'type' | 'status'>>;
}

export function getInsightSchedule() {
  return api.get<InsightSchedulePreferences>('/insights/schedule', {
    throwOnError: true,
  });
}

export function updateInsightSchedule(patch: Partial<InsightSchedulePreferences>) {
  return api.patch<InsightSchedulePreferences>('/insights/schedule', patch, {
    throwOnError: true,
  });
}

export function listInsightRuns() {
  return api.get<InsightGenerationRun[]>('/insights/runs', {
    fallback: [],
    throwOnError: true,
  });
}

export function retryInsightRun(id: string) {
  return api.post<InsightGenerationRun>(
    `/insights/runs/${encodeURIComponent(id)}/retry`,
    {},
    { throwOnError: true, timeoutMs: 75_000 },
  );
}

export function regenerateInsightRun(id: string) {
  return api.post<InsightGenerationRun>(
    `/insights/runs/${encodeURIComponent(id)}/regenerate`,
    {},
    { throwOnError: true, timeoutMs: 75_000 },
  );
}
