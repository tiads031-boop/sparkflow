import { BadGatewayException, BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CourseService } from './course.service';
import { parseCourseBackup } from './course-backup';

export function parseHolidays(value: unknown, year: number): string[] {
  const data = value as { year?: number; days?: { date?: unknown; isOffDay?: unknown }[] };
  if (!data || data.year !== year || !Array.isArray(data.days) || data.days.length > 366) throw new BadGatewayException('节假日数据格式无效');
  if (!data.days.every(d => d && typeof d.isOffDay === 'boolean')) throw new BadGatewayException('节假日标记无效');
  const dates = data.days.filter(d => d.isOffDay === true).map(d => d.date);
  if (!dates.every(d => typeof d === 'string' && d.startsWith(`${year}-`) && /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d)) && new Date(d).toISOString().slice(0, 10) === d)) throw new BadGatewayException('节假日日期无效');
  return [...new Set(dates as string[])].sort();
}
export function webdavTarget(base: unknown, allowed: string[], userId: string): URL {
  if (typeof base !== 'string' || !userId) throw new BadRequestException('请填写 WebDAV 目录和用户标识');
  let url: URL;
  try { url = new URL(base); } catch { throw new BadRequestException('WebDAV 地址无效'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !allowed.includes(url.origin)) {
    throw new BadRequestException('该 WebDAV 源尚未配置到服务器 WEBDAV_ALLOWED_ORIGINS，或地址含有账号/查询参数');
  }
  url.pathname = url.pathname.replace(/\/$/, '') + `/sparkflow-courses-${encodeURIComponent(userId)}.json`;
  return url;
}
async function boundedText(response: Response) {
  if (Number(response.headers.get('content-length')) > 8 * 1024 * 1024) throw new BadGatewayException('远端文件超过 8 MB');
  if (!response.body) return '';
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 8 * 1024 * 1024) throw new BadGatewayException('远端文件超过 8 MB'); chunks.push(part.value); }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString('utf8');
}
export interface DavRequest { url?: string; username?: string; password?: string; etag?: string }
@Injectable()
export class CourseIntegrationsService {
  private holidaysCache = new Map<number, { dates: string[]; fetchedAt: string }>();
  constructor(private config: ConfigService, private courses: CourseService) {}
  async holidays(year: number) {
    if (!Number.isInteger(year) || year < 2007 || year > 2100) throw new BadRequestException('年份无效');
    const cached = this.holidaysCache.get(year);
    if (cached && Date.now() - Date.parse(cached.fetchedAt) < 86400000) return { ...cached, year, stale: false };
    try {
      const response = await fetch(`https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/${year}.json`, { signal: AbortSignal.timeout(15000), redirect: 'error' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const dates = parseHolidays(JSON.parse(await boundedText(response)), year);
      const result = { dates, fetchedAt: new Date().toISOString() }; this.holidaysCache.set(year, result);
      return { ...result, year, stale: false };
    } catch {
      if (cached) return { ...cached, year, stale: true };
      throw new BadGatewayException(`${year} 年节假日数据暂不可用或尚未发布，请稍后重试`);
    }
  }
  davStatus() {
    return { defaultUrl: this.config.get<string>('WEBDAV_URL') || '', configured: !!this.config.get<string>('WEBDAV_ALLOWED_ORIGINS') };
  }
  private davOptions(userId: string, data: DavRequest) {
    const defaultUrl = this.config.get<string>('WEBDAV_URL') || '';
    const url = webdavTarget(data.url || defaultUrl, (this.config.get<string>('WEBDAV_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()), userId);
    // Server credentials may only be sent to the configured directory, never to another allowed server.
    const useDefault = !data.url || data.url === defaultUrl;
    const username = data.username || (useDefault ? this.config.get<string>('WEBDAV_USERNAME') : '') || '';
    const password = data.password || (useDefault ? this.config.get<string>('WEBDAV_PASSWORD') : '') || '';
    return { url, headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } };
  }
  async readDav(userId: string, data: DavRequest) {
    const { url, headers } = this.davOptions(userId, data);
    let response: Response;
    try { response = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(20000) }); }
    catch { throw new BadGatewayException('WebDAV 连接失败，请检查地址、网络和证书'); }
    if (response.status === 404) return { exists: false, etag: null, backup: null };
    if (!response.ok) throw new BadGatewayException(`WebDAV 读取失败（${response.status}），请检查账号和目录权限`);
    let backup: unknown;
    try { backup = JSON.parse(await boundedText(response)); } catch { throw new BadGatewayException('远端不是有效的课表 JSON 或文件过大'); }
    parseCourseBackup(backup);
    return { exists: true, etag: response.headers.get('etag'), backup };
  }
  async writeDav(userId: string, data: DavRequest) {
    const { url, headers } = this.davOptions(userId, data);
    if (data.etag && (!/^"[^\r\n"]+"$/.test(data.etag) || data.etag.length > 500)) throw new BadRequestException('远端未提供可用于安全覆盖的强 ETag，请使用新的空目录备份');
    const backup = await this.courses.exportSchedule(userId);
    const body = JSON.stringify(backup);
    if (Buffer.byteLength(body) > 8 * 1024 * 1024) throw new BadRequestException('课表超过 8 MB，请使用本地备份');
    let response: Response;
    try { response = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json', ...(data.etag ? { 'If-Match': data.etag } : { 'If-None-Match': '*' }) }, body, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw new BadGatewayException('WebDAV 上传结果未确认，请先重新检查远端文件'); }
    if (response.status === 412 || response.status === 409) throw new ConflictException('远端文件已变化或目录不存在，请重新检查远端；原文件未被覆盖');
    if (!response.ok) throw new BadGatewayException(`WebDAV 上传失败（${response.status}）`);
    return { saved: true, etag: response.headers.get('etag') };
  }
}
