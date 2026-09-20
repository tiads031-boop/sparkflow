import type { Prisma } from '@prisma/client';

export type InsightCadence = 'weekly' | 'interval';

export interface InsightSchedulePreferences {
  enabled: boolean;
  cadence: InsightCadence;
  weekDay: number;
  hour: number;
  minute: number;
  intervalDays: number;
  timeZone: string;
  anchorDate: string;
}

export interface InsightScheduleWindow {
  runKey: string;
  periodStart: Date;
  periodEnd: Date;
  scheduledFor: Date;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function integer(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function validTimeZone(value: unknown): string {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function addLocalDays(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return dateKey(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
}

function diffLocalDays(left: string, right: string) {
  const parse = (key: string) => {
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.floor((parse(left) - parse(right)) / 86_400_000);
}

function zonedLocalToUtc(key: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = key.split('-').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localParts(new Date(guess), timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    const delta = desired - actualAsUtc;
    guess += delta;
    if (delta === 0) break;
  }
  return new Date(guess);
}

export function parseInsightSchedule(
  settings: unknown,
  now = new Date(),
): InsightSchedulePreferences {
  const root = objectValue(settings);
  const raw = objectValue(root.insightSchedule);
  const notification = objectValue(root.notification);
  const timeZone = validTimeZone(raw.timeZone ?? notification.timeZone);
  const parts = localParts(now, timeZone);
  const today = dateKey(parts.year, parts.month, parts.day);
  return {
    enabled: raw.enabled === true,
    cadence: raw.cadence === 'interval' ? 'interval' : 'weekly',
    weekDay: integer(raw.weekDay, 0, 0, 6),
    hour: integer(raw.hour, 20, 0, 23),
    minute: integer(raw.minute, 0, 0, 59),
    intervalDays: integer(raw.intervalDays, 7, 2, 90),
    timeZone,
    anchorDate: typeof raw.anchorDate === 'string' && DATE_RE.test(raw.anchorDate)
      ? raw.anchorDate
      : today,
  };
}

export function normalizeInsightSchedulePatch(
  current: InsightSchedulePreferences,
  patch: Partial<InsightSchedulePreferences>,
  now = new Date(),
): InsightSchedulePreferences {
  const next = parseInsightSchedule({
    insightSchedule: {
      ...current,
      ...patch,
      enabled: patch.enabled ?? current.enabled,
      cadence: patch.cadence ?? current.cadence,
      timeZone: patch.timeZone ?? current.timeZone,
      anchorDate: patch.anchorDate ?? current.anchorDate,
    },
  }, now);
  if (patch.cadence && patch.cadence !== current.cadence && !patch.anchorDate) {
    const parts = localParts(now, next.timeZone);
    next.anchorDate = dateKey(parts.year, parts.month, parts.day);
  }
  return next;
}

export function mergeInsightScheduleSettings(
  settings: unknown,
  schedule: InsightSchedulePreferences,
): Prisma.InputJsonValue {
  return {
    ...objectValue(settings),
    insightSchedule: schedule,
  } as unknown as Prisma.InputJsonValue;
}

export function resolveInsightScheduleWindow(
  now: Date,
  schedule: InsightSchedulePreferences,
): InsightScheduleWindow | null {
  if (!schedule.enabled) return null;
  const parts = localParts(now, schedule.timeZone);
  const today = dateKey(parts.year, parts.month, parts.day);
  const currentMinutes = parts.hour * 60 + parts.minute;
  const targetMinutes = schedule.hour * 60 + schedule.minute;
  let endDate: string;
  let spanDays: number;

  if (schedule.cadence === 'weekly') {
    const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
    let daysBack = (weekday - schedule.weekDay + 7) % 7;
    if (daysBack === 0 && currentMinutes < targetMinutes) daysBack = 7;
    endDate = addLocalDays(today, -daysBack);
    spanDays = 7;
  } else {
    const elapsed = Math.max(0, diffLocalDays(today, schedule.anchorDate));
    let completedIntervals = Math.floor(elapsed / schedule.intervalDays);
    endDate = addLocalDays(schedule.anchorDate, completedIntervals * schedule.intervalDays);
    if (endDate === today && currentMinutes < targetMinutes) {
      completedIntervals -= 1;
      endDate = addLocalDays(schedule.anchorDate, completedIntervals * schedule.intervalDays);
    }
    if (completedIntervals < 0) return null;
    spanDays = schedule.intervalDays;
  }

  const scheduledFor = zonedLocalToUtc(
    endDate,
    schedule.hour,
    schedule.minute,
    schedule.timeZone,
  );
  if (scheduledFor.getTime() > now.getTime()) return null;
  const startDate = addLocalDays(endDate, -spanDays);
  return {
    runKey: `auto:${schedule.cadence}:${endDate}`,
    periodStart: zonedLocalToUtc(startDate, schedule.hour, schedule.minute, schedule.timeZone),
    periodEnd: scheduledFor,
    scheduledFor,
  };
}
