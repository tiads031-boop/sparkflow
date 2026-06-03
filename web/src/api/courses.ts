/**
 * Course API 客户端
 *
 * 所有课程相关 HTTP 请求的统一入口。
 * 依赖 api/client.ts 的 apiRequest / api / DEFAULT_USER_ID。
 */

import { apiRequest, DEFAULT_USER_ID } from './client';
import type { Course, CourseDetail, CourseNote, CourseFormData, CalendarEvent } from '../types';

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
  options?: { semesterStart?: string; semesterEnd?: string; excludeCourses?: string[] },
): Promise<{ created: string[]; updated: string[]; eventCount: number }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
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

// ── 课程笔记 ──

/** 获取课程笔记 */
export async function fetchCourseNotes(courseId: string, userId = DEFAULT_USER_ID): Promise<CourseNote[]> {
  const res = await apiRequest(`${BASE}/${courseId}/notes?userId=${userId}`);
  return res.json();
}

/** 创建笔记 */
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

/** 更新笔记 */
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

/** 删除笔记 */
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
