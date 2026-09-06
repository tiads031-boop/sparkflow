import { apiRequest, DEFAULT_USER_ID } from './client';
import type { ScheduleBackup } from '../utils/courseSchedule';
export interface DavConfig { url: string; username: string; password: string }
export interface DavRemote { exists: boolean; etag: string | null; backup: ScheduleBackup | null }
export async function davStatus(): Promise<{ defaultUrl: string; configured: boolean }> { return (await apiRequest('/course-integrations/webdav')).json(); }
export async function readDav(config: DavConfig): Promise<DavRemote> {
  return (await apiRequest(`/course-integrations/webdav/read?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, { method: 'POST', body: JSON.stringify(config) })).json();
}
export async function writeDav(config: DavConfig, etag?: string | null) {
  return (await apiRequest(`/course-integrations/webdav/write?userId=${encodeURIComponent(DEFAULT_USER_ID)}`, { method: 'POST', body: JSON.stringify({ ...config, etag: etag || undefined }) })).json();
}
export async function fetchHolidays(year: number): Promise<{ dates: string[]; fetchedAt: string; year: number; stale: boolean }> {
  return (await apiRequest(`/course-integrations/holidays?year=${year}`)).json();
}
