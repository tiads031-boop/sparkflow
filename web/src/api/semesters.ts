/**
 * Semester API 客户端
 *
 * 学期 CURD + 激活切换。
 * 依赖 api/client.ts 的 apiRequest / DEFAULT_USER_ID。
 */

import { apiRequest, DEFAULT_USER_ID } from './client';
import type { Semester } from '../types';

const BASE = '/semesters';

/** 获取用户所有学期 */
export async function fetchSemesters(userId = DEFAULT_USER_ID): Promise<Semester[]> {
  const res = await apiRequest(`${BASE}?userId=${userId}`);
  return res.json();
}

/** 创建学期 */
export async function createSemester(data: {
  userId?: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}): Promise<Semester> {
  const res = await apiRequest(BASE, {
    method: 'POST',
    body: JSON.stringify({ ...data, userId: data.userId || DEFAULT_USER_ID }),
  });
  return res.json();
}

/** 更新学期 */
export async function updateSemester(
  id: string,
  data: Record<string, any>,
  userId = DEFAULT_USER_ID,
): Promise<Semester> {
  const res = await apiRequest(`${BASE}/${id}?userId=${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.json();
}

/** 删除学期 */
export async function deleteSemester(id: string, userId = DEFAULT_USER_ID): Promise<void> {
  await apiRequest(`${BASE}/${id}?userId=${userId}`, { method: 'DELETE' });
}
