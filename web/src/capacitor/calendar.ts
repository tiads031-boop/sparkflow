/**
 * Capacitor 系统日历桥接层
 *
 * 使用 @ebarooni/capacitor-calendar 插件操作 Android 系统日历。
 * 与 Google Calendar API 的关系：
 *   - Google Calendar API：Sparkflow ↔ Google 云端（同步中枢）
 *   - 系统日历：Android 自动同步 Google 日历到本地（红米 K70 系统自带）
 *   - 本模块：作为补充，允许 Sparkflow 直接写入系统日历
 *
 * 典型场景：
 *   后端通过 Google Calendar API 创建事件 → Google 自动同步到手机系统日历
 *   用户已可在系统日历中看到。本模块仅在需要手动干预时使用。
 */

import { CapacitorCalendar } from '@ebarooni/capacitor-calendar';
import { api, DEFAULT_USER_ID } from '../api/client';
import type { Task } from '../types';

export interface SystemCalendarEvent {
  title: string;
  startDate: number; // epoch ms
  endDate: number;
  location?: string;
  description?: string;
  isAllDay?: boolean;
  color?: string;
}

export interface NormalizedLocalCalendarEvent {
  externalId: string;
  title: string;
  startTime: string;
  endTime: string;
  location?: string;
  description?: string;
  isAllDay: boolean;
  source: 'android-local';
  calendarId?: string | null;
  color?: string | null;
}

export interface ImportLocalCalendarResult {
  importedCount?: number;
  imported?: number;
  created?: number;
  updated?: number;
  skipped?: number;
  eventCount?: number;
}

function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

export function isSystemCalendarAvailable(): boolean {
  return isCapacitorNative();
}

function normalizeSystemEvent(event: any): NormalizedLocalCalendarEvent | null {
  const startDate = Number(event?.startDate);
  const endDate = Number(event?.endDate);
  if (!event?.id || !event?.title || !Number.isFinite(startDate) || !Number.isFinite(endDate)) {
    return null;
  }

  return {
    externalId: `${event.calendarId ?? 'default'}:${event.id}`,
    title: String(event.title),
    startTime: new Date(startDate).toISOString(),
    endTime: new Date(endDate).toISOString(),
    location: event.location || undefined,
    description: event.description || undefined,
    isAllDay: Boolean(event.isAllDay),
    source: 'android-local',
    calendarId: event.calendarId ?? null,
    color: event.color ?? null,
  };
}

function taskToSystemEvent(task: Task): SystemCalendarEvent | null {
  if (!task.startTime) return null;
  const baseDate = task.dueDate ? new Date(task.dueDate) : new Date();
  const [hours, minutes] = task.startTime.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  baseDate.setHours(hours || 0, minutes || 0, 0, 0);
  const startDate = baseDate.getTime();
  const duration = task.duration || task.estimatedMinutes || 60;

  return {
    title: task.title,
    startDate,
    endDate: startDate + duration * 60_000,
    description: task.description || 'SparkFlow task',
    color: task.colorType === 'green' ? '#cae393' : task.colorType === 'purple' ? '#b0a8db' : '#242424',
  };
}

/** 请求完整的日历读写权限 */
export async function requestCalendarPermission(): Promise<boolean> {
  try {
    const result = await CapacitorCalendar.requestFullCalendarAccess();
    return result.result === 'granted';
  } catch (e) {
    console.error('[Calendar] 权限请求失败:', e);
    return false;
  }
}

/** 检查当前日历权限状态 */
export async function checkCalendarPermission(): Promise<boolean> {
  try {
    const { result } = await CapacitorCalendar.checkAllPermissions();
    // result 是 Record<CalendarPermissionScope, PermissionState>
    const scopes = Object.values(result);
    return scopes.some((state) => state === 'granted');
  } catch {
    return false;
  }
}

/**
 * 将事件添加到系统日历
 *
 * 注意：这会直接写入系统日历，与 Google Calendar API 创建的事件是独立的。
 * 通常应该让后端通过 Google Calendar API 创建事件，然后让 Android 系统自动同步。
 * 此方法仅用于离线场景或需要绕过 Google 同步的特殊情况。
 */
export async function addToSystemCalendar(
  event: SystemCalendarEvent,
): Promise<string | null> {
  try {
    // 确保有权限
    const hasPermission = await checkCalendarPermission();
    if (!hasPermission) {
      const granted = await requestCalendarPermission();
      if (!granted) {
        console.error('[Calendar] 无日历权限，无法创建事件');
        return null;
      }
    }

    const result = await CapacitorCalendar.createEvent({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      description: event.description,
      isAllDay: event.isAllDay ?? false,
      color: event.color,
    });

    console.log('[Calendar] 事件已创建, id:', result.id);
    return result.id;
  } catch (e) {
    console.error('[Calendar] 创建事件失败:', e);
    return null;
  }
}

/**
 * 通过系统日历原生 UI 创建事件（用户手动确认）
 * 比 addToSystemCalendar 更容易被 MIUI 省电策略放行
 */
export async function addToSystemCalendarWithPrompt(
  event: SystemCalendarEvent,
): Promise<string | null> {
  try {
    const result = await CapacitorCalendar.createEventWithPrompt({
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      description: event.description,
      isAllDay: event.isAllDay ?? false,
    });

    console.log('[Calendar] 事件已通过系统 UI 创建, id:', result.id);
    return result.id;
  } catch (e) {
    console.error('[Calendar] 通过系统 UI 创建事件失败:', e);
    return null;
  }
}

/** 查询指定时间范围内的系统日历事件 */
export async function listSystemCalendarEvents(
  from: number,
  to: number,
) {
  try {
    const { result } = await CapacitorCalendar.listEventsInRange({
      from,
      to,
    });
    return result;
  } catch (e) {
    console.error('[Calendar] 查询事件失败:', e);
    return [];
  }
}

/** 读取并归一化指定范围内的 Android 系统日历事件 */
export async function listNormalizedSystemCalendarEvents(
  from: number,
  to: number,
): Promise<NormalizedLocalCalendarEvent[]> {
  const events = await listSystemCalendarEvents(from, to);
  return events
    .map((event: any) => normalizeSystemEvent(event))
    .filter((event): event is NormalizedLocalCalendarEvent => Boolean(event));
}

/** 导入近期 Android/Xiaomi 本地日历事件到 SparkFlow 后端 */
export async function importLocalCalendarEvents(options?: {
  from?: number;
  to?: number;
  userId?: string;
}): Promise<ImportLocalCalendarResult> {
  const now = Date.now();
  const from = options?.from ?? now - 7 * 24 * 60 * 60 * 1000;
  const to = options?.to ?? now + 30 * 24 * 60 * 60 * 1000;
  const userId = options?.userId ?? DEFAULT_USER_ID;

  const hasPermission = await checkCalendarPermission();
  if (!hasPermission) {
    const granted = await requestCalendarPermission();
    if (!granted) throw new Error('未获得系统日历权限');
  }

  const events = await listNormalizedSystemCalendarEvents(from, to);
  const payloadEvents = events.map((event) => ({
    externalEventId: event.externalId,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location,
    description: event.description,
    isAllDay: event.isAllDay,
    sourceCalendarTitle: event.calendarId ?? undefined,
    color: event.color ?? undefined,
  }));

  return api.post<ImportLocalCalendarResult>(
    '/calendar/import-local',
    { userId, events: payloadEvents, source: 'android-local' },
    { throwOnError: true },
  );
}

/** 将 SparkFlow 已安排任务写入系统日历 */
export async function exportTasksToSystemCalendar(tasks: Task[]): Promise<{
  created: number;
  failed: number;
}> {
  const scheduledEvents = tasks
    .filter((task) => task.status !== 'Cancelled')
    .map(taskToSystemEvent)
    .filter((event): event is SystemCalendarEvent => Boolean(event));

  let created = 0;
  let failed = 0;

  for (const event of scheduledEvents) {
    const id = await addToSystemCalendar(event);
    if (id) created += 1;
    else failed += 1;
  }

  return { created, failed };
}

/** 删除系统日历中的事件 */
export async function deleteSystemCalendarEvent(eventId: string): Promise<boolean> {
  try {
    await CapacitorCalendar.deleteEvent({ id: eventId });
    return true;
  } catch (e) {
    console.error('[Calendar] 删除事件失败:', e);
    return false;
  }
}
