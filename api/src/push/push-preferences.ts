import { BadRequestException } from '@nestjs/common';
import {
  REMINDER_GRACE_MS,
  type ReminderTask,
} from './push-reminder';

export const MAX_NOTIFICATION_LEAD_MINUTES = 24 * 60;

export interface NotificationPreferences {
  taskRemindersEnabled: boolean;
  dueSoonFallbackEnabled: boolean;
  defaultReminderMinutes: number;
  courseRemindersEnabled: boolean;
  courseReminderMinutes: number;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  timeZone: string;
}

export interface CourseReminderEvent {
  id: string;
  userId: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  taskRemindersEnabled: true,
  dueSoonFallbackEnabled: true,
  defaultReminderMinutes: 30,
  courseRemindersEnabled: true,
  courseReminderMinutes: 15,
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

function validLeadMinutes(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= MAX_NOTIFICATION_LEAD_MINUTES
  );
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
    defaultReminderMinutes:
      validLeadMinutes(notification.defaultReminderMinutes)
        ? notification.defaultReminderMinutes
        : DEFAULT_NOTIFICATION_PREFERENCES.defaultReminderMinutes,
    courseRemindersEnabled:
      notification.courseRemindersEnabled !== false,
    courseReminderMinutes:
      validLeadMinutes(notification.courseReminderMinutes)
        ? notification.courseReminderMinutes
        : DEFAULT_NOTIFICATION_PREFERENCES.courseReminderMinutes,
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
    'courseRemindersEnabled',
    'quietHoursEnabled',
  ] as const) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') {
        throw new BadRequestException(`${key} must be boolean`);
      }
      next[key] = patch[key];
    }
  }

  for (const key of [
    'defaultReminderMinutes',
    'courseReminderMinutes',
  ] as const) {
    if (patch[key] !== undefined) {
      if (!validLeadMinutes(patch[key])) {
        throw new BadRequestException(
          `${key} must be an integer between 0 and ${MAX_NOTIFICATION_LEAD_MINUTES}`,
        );
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

function shouldDeliverScheduledMoment(
  scheduledFor: Date,
  preferences: NotificationPreferences,
  now: Date,
) {
  if (scheduledFor > now) return false;

  const ageMs = now.getTime() - scheduledFor.getTime();
  if (ageMs < 0) return false;

  if (!preferences.quietHoursEnabled) {
    return ageMs <= REMINDER_GRACE_MS;
  }

  if (isQuietAt(now, preferences)) return false;

  if (!isQuietAt(scheduledFor, preferences)) {
    return ageMs <= REMINDER_GRACE_MS;
  }

  // A reminder becoming due in quiet hours may be delivered shortly after
  // quietEnd. Do not carry quiet reminders into another day.
  if (ageMs > 24 * 60 * 60 * 1000) return false;

  const nowMinute = localMinuteOfDay(now, preferences.timeZone);
  const endMinute = minuteOfDay(preferences.quietEnd);
  const minutesAfterQuietEnd = (nowMinute - endMinute + 24 * 60) % (24 * 60);

  return minutesAfterQuietEnd * 60 * 1000 <= REMINDER_GRACE_MS;
}

export function taskReminderScheduledFor(
  task: ReminderTask,
  preferences: NotificationPreferences,
): Date | null {
  if (task.reminderAt) return new Date(task.reminderAt);
  if (
    !task.dueDate
    || !preferences.dueSoonFallbackEnabled
  ) return null;

  return new Date(
    task.dueDate.getTime() - preferences.defaultReminderMinutes * 60_000,
  );
}

export function courseReminderScheduledFor(
  event: CourseReminderEvent,
  preferences: NotificationPreferences,
) {
  return new Date(
    event.startTime.getTime() - preferences.courseReminderMinutes * 60_000,
  );
}

export function shouldDeliverReminder(
  task: ReminderTask,
  preferences: NotificationPreferences,
  now: Date,
) {
  if (!preferences.taskRemindersEnabled) return false;
  const scheduledFor = taskReminderScheduledFor(task, preferences);
  return scheduledFor
    ? shouldDeliverScheduledMoment(scheduledFor, preferences, now)
    : false;
}

export function shouldDeliverCourseReminder(
  event: CourseReminderEvent,
  preferences: NotificationPreferences,
  now: Date,
) {
  if (!preferences.courseRemindersEnabled) return false;
  if (event.endTime <= now) return false;

  const scheduledFor = courseReminderScheduledFor(event, preferences);

  // If the reminder itself was suppressed by quiet hours, don't wake the user
  // after the class has already started.
  if (
    preferences.quietHoursEnabled
    && isQuietAt(scheduledFor, preferences)
    && event.startTime <= now
  ) {
    return false;
  }

  return shouldDeliverScheduledMoment(scheduledFor, preferences, now);
}

export function buildNotificationDeliveryKey(
  sourceType: 'task' | 'course',
  userId: string,
  sourceId: string,
  scheduledFor: Date,
  subscriptionId: string,
) {
  return [
    sourceType,
    userId,
    sourceId,
    scheduledFor.toISOString(),
    subscriptionId,
  ].join(':');
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
