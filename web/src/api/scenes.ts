import { api } from './client';
import type { InspirationRecord } from './inspirations';

export type SceneField = { id: string; key: string; label: string; type: 'duration' | 'rating' | 'number' | 'text' | 'image' | 'location' | 'people'; required: boolean; unit?: string; min?: number; max?: number };
export type SceneTemplate = { id: string; name: string; emoji: string; color: string; description: string | null; category: string | null; status: 'active' | 'archived'; fieldSchema: SceneField[]; triggers: string[]; allowedViews: Array<'heatmap' | 'trend' | 'list' | 'photo'> };
export type SceneEntry = { id: string; sourceType: 'focus' | 'manual' | 'note' | 'task'; occurredAt: string; metadata: Record<string, string | number>; tags: string[]; inspiration: InspirationRecord | null; pomodoroSession: { id: string; title: string | null; effectiveDurationSeconds: number } | null };
export type SceneAnalytics = { totalCount: number; totalDurationSeconds: number; averageRating: number | null; buckets: Array<{ key: string; count: number; durationSeconds: number; averageRating: number | null }>; heatmap: Array<{ date: string; count: number; durationSeconds: number }>; hasImages: boolean };

const path = (id: string) => `/scenes/${encodeURIComponent(id)}`;
const required = { throwOnError: true } as const;
export const listScenes = (status: 'active' | 'archived' = 'active') => api.get<SceneTemplate[]>(`/scenes?status=${status}`, required);
export const createScene = (input: Record<string, unknown>) => api.post<SceneTemplate>('/scenes', input, required);
export const updateScene = (id: string, input: Record<string, unknown>) => api.patch<SceneTemplate>(path(id), input, required);
export const setSceneArchived = (id: string, archived: boolean) => api.patch<SceneTemplate>(`${path(id)}/${archived ? 'archive' : 'restore'}`, {}, required);
export const reorderScenes = (ids: string[]) => api.post<SceneTemplate[]>('/scenes/reorder', { ids }, required);
export const listSceneEntries = (id: string, start: string, end: string, cursor?: string) => api.get<{ items: SceneEntry[]; nextCursor: string | null }>(`${path(id)}/entries?${new URLSearchParams({ start, end, limit: '30', ...(cursor ? { cursor } : {}) })}`, required);
export const sceneAnalytics = (id: string, start: string, end: string, timeZone: string, bucket: 'day' | 'week' | 'month' = 'day') => api.get<SceneAnalytics>(`${path(id)}/analytics?${new URLSearchParams({ start, end, timeZone, bucket })}`, required);
export const createSceneEntry = (id: string, input: Record<string, unknown>) => api.post<SceneEntry>(`${path(id)}/entries`, input, required);
export const updateSceneEntry = (id: string, entryId: string, input: { occurredAt: string; metadata: Record<string, string | number>; tags: string[] }) => api.patch<SceneEntry>(`${path(id)}/entries/${encodeURIComponent(entryId)}`, input, required);
export const deleteSceneEntry = (id: string, entryId: string) => api.delete(`${path(id)}/entries/${encodeURIComponent(entryId)}`, required);
