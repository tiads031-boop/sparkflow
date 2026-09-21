import { api } from './client';

export interface ActualTimelineEntry {
  id: string;
  taskId: string | null;
  title: string;
  start: string;
  end: string;
  effectiveDurationSeconds: number;
  pausedDurationSeconds: number;
  source: 'focus' | 'manual';
  status: 'completed' | 'interrupted';
  notes: string | null;
  tags: string[];
}

export interface ManualActualTimeInput {
  title?: string;
  taskId?: string;
  startedAt: string;
  endedAt: string;
  notes?: string;
  tags?: string[];
  clientRequestId: string;
}

export function getActualTimeline(start: string, end: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ start, end });
  return api.get<ActualTimelineEntry[]>(`/pomodoro/timeline?${query.toString()}`, {
    signal,
    throwOnError: true,
  });
}

export function createManualActualTime(input: ManualActualTimeInput) {
  return api.post<ActualTimelineEntry>('/pomodoro/manual', input, { throwOnError: true });
}

export function deleteActualTime(id: string) {
  return api.delete(`/pomodoro/${id}`, { throwOnError: true });
}
