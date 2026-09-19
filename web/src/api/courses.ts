/**
 * Course API 客户端
 *
 * 所有课程相关 HTTP 请求的统一入口。
 * 依赖 api/client.ts 的 apiRequest / api / DEFAULT_USER_ID。
 */

import { apiRequest, DEFAULT_USER_ID } from './client';
import type { Course, CourseDetail, CourseNote, CourseFormData, CalendarEvent } from '../types';
import type { ScheduleBackup } from '../utils/courseSchedule';

export type CourseImportDuplicatePolicy = 'skip' | 'keep';

export type CourseChangeRequest =
  | {
      type: 'reschedule';
      eventId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
    }
  | {
      type: 'cancel';
      eventId: string;
    }
  | {
      type: 'extra';
      courseId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
      title?: string;
    }
  | {
      type: 'swap';
      eventId: string;
      otherEventId: string;
    };

export interface CourseChangePreviewItem {
  action: 'update' | 'cancel' | 'create';
  eventId: string | null;
  courseId: string;
  courseName: string;
  title: string;
  from: { startTime: string; endTime: string; location: string | null } | null;
  to: { startTime: string; endTime: string; location: string | null } | null;
}

export interface CourseChangePreview {
  type: CourseChangeRequest['type'];
  changes: CourseChangePreviewItem[];
  conflicts: Array<{
    changeIndex: number;
    sourceType: 'calendar' | 'task';
    id: string;
    title: string;
    startTime: string;
    endTime: string;
  }>;
}

export interface CourseChangeCandidate extends CalendarEvent {
  course: Pick<Course, 'id' | 'name' | 'color' | 'room' | 'teacher'>;
}

export interface CourseImportSource {
  system: string;
  schoolId: string;
  adapterId: string;
  termId?: string;
  origin?: string;
  fetchedAt?: string;
}

export interface CourseImportRequest {
  format: 'sparkflow-course-import';
  version: 2;
  requestId: string;
  targetSemesterId?: string;
  duplicatePolicy: CourseImportDuplicatePolicy;
  source?: CourseImportSource;
  backup: ScheduleBackup;
}

export interface CourseImportPreview {
  requestId?: string;
  payloadHash: string;
  targetSemester: { id: string; name: string; startDate: string; endDate: string } | null;
  duplicatePolicy: CourseImportDuplicatePolicy;
  summary: { scheduleEntryCount: number; newCount: number; duplicateCount: number; conflictCount: number };
  items: Array<{ index: number; fingerprint: string; duplicate: boolean; conflictCourseIds: string[] }>;
}

export interface CourseImportResult {
  requestId?: string;
  replayed?: boolean;
  targetSemesterId?: string;
  scheduleEntryCount?: number;
  courseCount: number;
  eventCount: number;
  skippedCount?: number;
  conflictCount?: number;
}

export async function fetchScheduleBackup(semesterId?: string | null, signal?: AbortSignal): Promise<ScheduleBackup> {
  const query = new URLSearchParams({ userId: DEFAULT_USER_ID });
  if (semesterId) query.set('semesterId', semesterId);
  return (await apiRequest(`/courses/backup?${query}`, { signal })).json();
}
export async function importScheduleBackup(backup: unknown): Promise<CourseImportResult> {
  return (await apiRequest(`/courses/import-json?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, { method: 'POST', body: JSON.stringify(backup) })).json();
}
export async function previewScheduleImport(request: CourseImportRequest): Promise<CourseImportPreview> {
  return (await apiRequest(`/courses/import-json/preview?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, { method: 'POST', body: JSON.stringify(request) })).json();
}
export async function fetchScheduleImport(requestId: string): Promise<{ status: string; result?: CourseImportResult }> {
  return (await apiRequest(`/courses/imports/${encodeURIComponent(requestId)}?userId=${encodeURIComponent(DEFAULT_USER_ID)}`)).json();
}

const BASE = '/courses';

/** 获取用户所有课程（可选按学期筛选） */
export async function fetchCourses(userId = DEFAULT_USER_ID, semesterId?: string | null, signal?: AbortSignal): Promise<Course[]> {
  let url = `${BASE}?userId=${userId}`;
  if (semesterId) url += `&semesterId=${semesterId}`;
  const res = await apiRequest(url, { signal });
  return res.json();
}

/** 获取单个课程详情（含 events、tasks、notes） */
export async function fetchCourseDetail(id: string, userId = DEFAULT_USER_ID): Promise<CourseDetail> {
  const res = await apiRequest(`${BASE}/${id}?userId=${userId}`);
  return res.json();
}

/** 创建课程 */
export async function createCourse(data: CourseFormData & { userId?: string }): Promise<CourseDetail> {
  const res = await apiRequest(BASE, {
    method: 'POST',
    body: JSON.stringify({ ...data, userId: data.userId || DEFAULT_USER_ID }),
  });
  return res.json();
}

/** 更新课程 */
export async function updateCourse(
  id: string,
  data: Partial<CourseFormData & { regenerate?: boolean }>,
  userId = DEFAULT_USER_ID,
): Promise<CourseDetail> {
  const res = await apiRequest(`${BASE}/${id}?userId=${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除课程 */
export async function deleteCourse(id: string, userId = DEFAULT_USER_ID): Promise<void> {
  await apiRequest(`${BASE}/${id}?userId=${userId}`, { method: 'DELETE' });
}

// ── ICS 导入 ──

/** 上传 ICS 文件导入课程 */
export async function importIcs(
  file: File,
  userId = DEFAULT_USER_ID,
  options?: { semesterId?: string; semesterStart?: string; semesterEnd?: string; excludeCourses?: string[] },
): Promise<{ created: string[]; updated: string[]; eventCount: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  if (options?.semesterId) formData.append('semesterId', options.semesterId);
  if (options?.semesterStart) formData.append('semesterStart', options.semesterStart);
  if (options?.semesterEnd) formData.append('semesterEnd', options.semesterEnd);
  if (options?.excludeCourses?.length) {
    formData.append('excludeCourses', options.excludeCourses.join(','));
  }
  const res = await apiRequest(`${BASE}/import-ics`, {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

// ── 课程任务（兼容既有 notes 路径） ──

/** 获取课程任务 */
export async function fetchCourseNotes(courseId: string, userId = DEFAULT_USER_ID): Promise<CourseNote[]> {
  const res = await apiRequest(`${BASE}/${courseId}/notes?userId=${userId}`);
  return res.json();
}

/** 创建课程任务 */
export async function createCourseNote(
  courseId: string,
  body: string,
  pinned = false,
  userId = DEFAULT_USER_ID,
): Promise<CourseNote> {
  const res = await apiRequest(`${BASE}/notes`, {
    method: 'POST',
    body: JSON.stringify({ userId, courseId, body, pinned }),
  });
  return res.json();
}

/** 更新课程任务 */
export async function updateCourseNote(
  noteId: string,
  data: { body?: string; pinned?: boolean },
  userId = DEFAULT_USER_ID,
): Promise<CourseNote> {
  const res = await apiRequest(`${BASE}/notes/${noteId}?userId=${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除课程任务 */
export async function deleteCourseNote(noteId: string, userId = DEFAULT_USER_ID): Promise<void> {
  await apiRequest(`${BASE}/notes/${noteId}?userId=${userId}`, { method: 'DELETE' });
}

// ── 调课（修改单个实例） ──

/** 调整单个课程实例（调课） */
export async function adjustCourseEvent(
  eventId: string,
  data: { startTime?: string; endTime?: string; room?: string; title?: string },
  userId = DEFAULT_USER_ID,
): Promise<CalendarEvent> {
  const res = await apiRequest(`${BASE}/events/${eventId}?userId=${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}


// ── 课程 occurrence 变动（调课 / 换课 / 停课 / 补课） ──

export async function previewCourseChange(
  data: CourseChangeRequest,
): Promise<CourseChangePreview> {
  const res = await apiRequest(`${BASE}/changes/preview`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function applyCourseChange(
  data: CourseChangeRequest,
): Promise<{
  planId: string;
  type: CourseChangeRequest['type'];
  appliedCount: number;
  overrideGroupId?: string | null;
  events: CalendarEvent[];
}> {
  const res = await apiRequest(`${BASE}/changes/apply`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchCourseChangeCandidates(
  start?: string,
  end?: string,
): Promise<CourseChangeCandidate[]> {
  const query = new URLSearchParams();
  if (start) query.set('start', start);
  if (end) query.set('end', end);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiRequest(`${BASE}/change-candidates${suffix}`);
  return res.json();
}


export async function undoCourseChange(
  planId: string,
): Promise<{ planId: string; restoredCount: number }> {
  const res = await apiRequest(`${BASE}/changes/${encodeURIComponent(planId)}/undo`, {
    method: 'POST',
  });
  return res.json();
}
