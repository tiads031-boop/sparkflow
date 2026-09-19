import { api } from './client';
import type { StudyFolder, StudyFolderInput } from '../types';

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
