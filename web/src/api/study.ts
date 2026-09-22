import { api } from './client';
import type { GoalProgressEntry, GoalProgressSummary, StudyFolder, StudyFolderInput } from '../types';

export function fetchStudyFolders(status: 'active' | 'archived' | 'all' = 'active') {
  return api.get<StudyFolder[]>(`/study/folders?status=${status}`, { fallback: [], throwOnError: true });
}

export function createStudyFolder(input: StudyFolderInput) {
  return api.post<StudyFolder>('/study/folders', input, { throwOnError: true });
}

export function updateStudyFolder(id: string, input: StudyFolderInput) {
  return api.patch<StudyFolder>(`/study/folders/${encodeURIComponent(id)}`, input, { throwOnError: true });
}

export function archiveStudyFolder(id: string) {
  return api.patch<StudyFolder>(`/study/folders/${encodeURIComponent(id)}/archive`, undefined, { throwOnError: true });
}

export function restoreStudyFolder(id: string) {
  return api.patch<StudyFolder>(`/study/folders/${encodeURIComponent(id)}/restore`, undefined, { throwOnError: true });
}

export function fetchGoalProgress(id: string, weekStart?: string, weekEnd?: string) {
  const params = new URLSearchParams();
  if (weekStart && weekEnd) {
    params.set('weekStart', weekStart);
    params.set('weekEnd', weekEnd);
  }
  const suffix = params.toString() ? `?${params}` : '';
  return api.get<GoalProgressSummary>(
    `/study/folders/${encodeURIComponent(id)}/progress${suffix}`,
    { throwOnError: true },
  );
}

export function createGoalProgressEntry(
  id: string,
  input: { value: number; occurredAt?: string; note?: string | null },
) {
  return api.post<GoalProgressEntry>(
    `/study/folders/${encodeURIComponent(id)}/progress-entries`,
    input,
    { throwOnError: true },
  );
}

export function updateGoalProgressEntry(
  id: string,
  entryId: string,
  input: { value?: number; occurredAt?: string; note?: string | null },
) {
  return api.patch<GoalProgressEntry>(
    `/study/folders/${encodeURIComponent(id)}/progress-entries/${encodeURIComponent(entryId)}`,
    input,
    { throwOnError: true },
  );
}

export function deleteGoalProgressEntry(id: string, entryId: string) {
  return api.delete<{ id: string; deleted: true }>(
    `/study/folders/${encodeURIComponent(id)}/progress-entries/${encodeURIComponent(entryId)}`,
    { throwOnError: true },
  );
}
