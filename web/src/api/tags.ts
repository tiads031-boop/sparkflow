import { api } from './client';

export interface TagRecord {
  id: string;
  userId: string;
  name: string;
  color: string;
  parentId?: string | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TagInput {
  name: string;
  color?: string;
  parentId?: string | null;
  sortOrder?: number;
  archived?: boolean;
}

export function listTags(includeArchived = false) {
  return api.get<TagRecord[]>(`/tags${includeArchived ? '?includeArchived=true' : ''}`, {
    fallback: [],
    throwOnError: true,
  });
}

export function createTag(input: TagInput) {
  return api.post<TagRecord>('/tags', input, { throwOnError: true });
}

export function updateTag(id: string, input: Partial<TagInput>) {
  return api.patch<TagRecord>(`/tags/${encodeURIComponent(id)}`, input, { throwOnError: true });
}

export function archiveTag(id: string) {
  return api.delete<TagRecord>(`/tags/${encodeURIComponent(id)}`, { throwOnError: true });
}
