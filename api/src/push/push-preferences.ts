import { BadRequestException } from '@nestjs/common';
import {
  REMINDER_GRACE_MS,
  reminderScheduledFor,
  type ReminderTask,
} from './push-reminder';

export interface NotificationPreferences {
  taskRemindersEnabled: boolean;
  dueSoonFallbackEnabled: boolean;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timeZone: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  taskRemindersEnabled: true,
  dueSoonFallbackEnabled: true,
  quietHoursEnabled: false,
  quietStart: '23:00',
  quietEnd: '07:00',
  timeZone: 'UTC',
};

const HH_MM = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function parseNotificationPreferences(settings: unknown): NotificationPreferences {
  const root = objectValue(settings);
  const notification = objectValue(root.notification);

  const timeZone = typeof notification.timeZone === 'string'
    && validTimeZone(notification.timeZone)
    ? notification.timeZone
    : DEFAULT_NOTIFICATION_PREFERENCES.timeZone;

  return {
    taskRemindersEnabled:
      notification.taskRemindersEnabled !== false,
    dueSoonFallbackEnabled:
      notification.dueSoonFallbackEnabled !== false,
    quietHoursEnabled:
      notification.quietHoursEnabled === true,
    quietStart:
      typeof notification.quietStart === 'string' && HH_MM.test(notification.quietStart)
        ? notification.quietStart
        : DEFAULT_NOTIFICATION_PREFERENCES.quietStart,
    quietEnd:
      typeof notification.quietEnd === 'string' && HH_MM.test(notification.quietEnd)
        ? notification.quietEnd
        : DEFAULT_NOTIFICATION_PREFERENCES.quietEnd,
    timeZone,
  };
}

export function normalizeNotificationPreferencesPatch(
  current: NotificationPreferences,
  patch: Partial<NotificationPreferences>,
): NotificationPreferences {
  const next = { ...current };

  for (const key of [
    'taskRemindersEnabled',
    'dueSoonFallbackEnabled',
    'quietHoursEnabled',
  ] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') {
        throw new BadRequestException(`${key} must be boolean`);
      }
      next[key] = patch[key];
    }
  }

  for (const key of ['quietStart', 'quietEnd'] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'string' || !HH_MM.test(patch[key])) {
        throw new BadRequestException(`${key} must use HH:MM`);
      }
      next[key] = patch[key];
    }
  }

  if (patch.timeZone !== undefined) {
    if (
      typeof patch.timeZone !== 'string'
      || !patch.timeZone.trim()
      || !validTimeZone(patch.timeZone.trim())
    ) {
      throw new BadRequestException('timeZone must be a valid IANA timezone');
    }
    next.timeZone = patch.timeZone.trim();
  }

  return next;
}

function minuteOfDay(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function localMinuteOfDay(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

export function isQuietAt(
  instant: Date,
  preferences: NotificationPreferences,
) {
  if (!preferences.quietHoursEnabled) return false;
  const start = minuteOfDay(preferences.quietStart);
  const end = minuteOfDay(preferences.quietEnd);
  if (start === end) return true;

  const current = localMinuteOfDay(instant, preferences.timeZone);
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

export function shouldDeliverReminder(
  task: ReminderTask,
  preferences: NotificationPreferences,
  now: Date,
) {
  if (!preferences.taskRemindersEnabled) return false;
  if (!task.reminderAt && !preferences.dueSoonFallbackEnabled) return false;

  const scheduledFor = reminderScheduledFor(task);
  if (!scheduledFor || scheduledFor > now) return false;

  const ageMs = now.getTime() - scheduledFor.getTime();
  if (ageMs < 0) return false;

  if (!preferences.quietHoursEnabled) {
    return ageMs <= REMINDER_GRACE_MS;
  }

  if (isQuietAt(now, preferences)) return false;

  if (!isQuietAt(scheduledFor, preferences)) {
    return ageMs <= REMINDER_GRACE_MS;
  }

  // A reminder that became due during quiet hours is deferred to the first
  // reminder-grace window after quietEnd. The 24h cap prevents yesterday's
  // quiet reminder from being treated as today's deferred reminder.
  if (ageMs > 24 * 60 * 60 * 1000) return false;

  const nowMinute = localMinuteOfDay(now, preferences.timeZone);
  const endMinute = minuteOfDay(preferences.quietEnd);
  const minutesAfterQuietEnd = (nowMinute - endMinute + 24 * 60) % (24 * 60);

  return minutesAfterQuietEnd * 60 * 1000 <= REMINDER_GRACE_MS;
}

export function mergeNotificationSettings(
  settings: unknown,
  preferences: NotificationPreferences,
) {
  const root = objectValue(settings);
  return {
    ...root,
    notification: preferences,
  };
}
