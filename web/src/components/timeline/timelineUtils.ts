import type { ScheduleItem } from '../../types';

export const TIMELINE_SNAP_MINUTES = 15;
export const TIMELINE_START_HOUR = 0;
export const TIMELINE_END_HOUR = 24;

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

export function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function snapMinutes(value: number, grain = TIMELINE_SNAP_MINUTES): number {
  return Math.round(value / grain) * grain;
}

export function weekDayIndexAtX(clientX: number, gridLeft: number, gridWidth: number): number {
  if (gridWidth <= 0) return 0;
  const rawIndex = Math.floor(((clientX - gridLeft) / gridWidth) * 7);
  return Math.max(0, Math.min(rawIndex, 6));
}

export function isRepeatInstance(item: ScheduleItem): boolean {
  return item.sourceType === 'task' && item.id !== `task:${item.sourceId}`;
}

export function moveItemToLocalMinute(item: ScheduleItem, date: Date, minuteOfDay: number) {
  const snapped = Math.max(0, Math.min(snapMinutes(minuteOfDay), 24 * 60 - TIMELINE_SNAP_MINUTES));
  const start = startOfDay(date);
  start.setMinutes(snapped);
  const end = new Date(start.getTime() + item.durationMinutes * 60_000);
  return { scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() };
}

export function resizeItem(item: ScheduleItem, durationMinutes: number) {
  const snappedDuration = Math.max(TIMELINE_SNAP_MINUTES, snapMinutes(durationMinutes));
  const start = new Date(item.start);
  return {
    estimatedMinutes: snappedDuration,
    duration: snappedDuration,
    scheduledEnd: new Date(start.getTime() + snappedDuration * 60_000).toISOString(),
  };
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
