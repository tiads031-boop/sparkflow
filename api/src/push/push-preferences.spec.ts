import { BadRequestException } from '@nestjs/common';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  buildNotificationDeliveryKey,
  courseReminderScheduledFor,
  isQuietAt,
  mergeNotificationSettings,
  normalizeNotificationPreferencesPatch,
  parseNotificationPreferences,
  shouldDeliverCourseReminder,
  shouldDeliverReminder,
  taskReminderScheduledFor,
} from './push-preferences';

describe('notification preferences', () => {
  it('parses defaults while preserving valid account values', () => {
    const parsed = parseNotificationPreferences({
      theme: 'dark',
      notification: {
        taskRemindersEnabled: false,
        defaultReminderMinutes: 60,
        courseRemindersEnabled: true,
        courseReminderMinutes: 30,
        quietHoursEnabled: true,
        quietStart: '22:30',
        quietEnd: '07:15',
        timeZone: 'Asia/Shanghai',
      },
    });

    expect(parsed).toEqual({
      taskRemindersEnabled: false,
      dueSoonFallbackEnabled: true,
      defaultReminderMinutes: 60,
      courseRemindersEnabled: true,
      courseReminderMinutes: 30,
      quietHoursEnabled: true,
      quietStart: '22:30',
      quietEnd: '07:15',
      timeZone: 'Asia/Shanghai',
    });
  });

  it('merges notification preferences without deleting unrelated user settings', () => {
    const merged = mergeNotificationSettings(
      { appearance: 'dark', nested: { keep: true } },
      DEFAULT_NOTIFICATION_PREFERENCES,
    );

    expect(merged).toEqual(expect.objectContaining({
      appearance: 'dark',
      nested: { keep: true },
      notification: DEFAULT_NOTIFICATION_PREFERENCES,
    }));
  });

  it('rejects invalid lead minutes and timezones', () => {
    expect(() => normalizeNotificationPreferencesPatch(
      DEFAULT_NOTIFICATION_PREFERENCES,
      { courseReminderMinutes: 2000 },
    )).toThrow(BadRequestException);

    expect(() => normalizeNotificationPreferencesPatch(
      DEFAULT_NOTIFICATION_PREFERENCES,
      { timeZone: 'Mars/Olympus' },
    )).toThrow(BadRequestException);
  });

  it('handles quiet hours that cross midnight in the configured timezone', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietStart: '23:00',
      quietEnd: '07:00',
      timeZone: 'Asia/Shanghai',
    };

    expect(isQuietAt(
      new Date('2026-09-19T16:30:00.000Z'),
      preferences,
    )).toBe(true);
    expect(isQuietAt(
      new Date('2026-09-19T23:30:00.000Z'),
      preferences,
    )).toBe(false);
  });

  it('uses the account default reminder lead for tasks without reminderAt', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      defaultReminderMinutes: 60,
    };
    const task = {
      id: 'task-1',
      userId: 'user-1',
      title: '交作业',
      reminderAt: null,
      dueDate: new Date('2026-09-20T10:00:00.000Z'),
    };

    expect(taskReminderScheduledFor(task, preferences)?.toISOString())
      .toBe('2026-09-20T09:00:00.000Z');
    expect(shouldDeliverReminder(
      task,
      preferences,
      new Date('2026-09-20T09:05:00.000Z'),
    )).toBe(true);
  });

  it('defers a reminder that became due during quiet hours to just after quietEnd', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietStart: '23:00',
      quietEnd: '07:00',
      timeZone: 'Asia/Shanghai',
    };
    const task = {
      id: 'task-quiet',
      userId: 'user-1',
      title: '夜间提醒',
      reminderAt: new Date('2026-09-19T17:00:00.000Z'), // 01:00 Asia/Shanghai
      dueDate: null,
    };

    expect(shouldDeliverReminder(
      task,
      preferences,
      new Date('2026-09-19T22:00:00.000Z'), // 06:00
    )).toBe(false);
    expect(shouldDeliverReminder(
      task,
      preferences,
      new Date('2026-09-19T23:05:00.000Z'), // 07:05
    )).toBe(true);
  });

  it('schedules and filters course reminders using the same quiet-hours rules', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      courseReminderMinutes: 30,
      timeZone: 'Asia/Shanghai',
    };
    const event = {
      id: 'course-event-1',
      userId: 'user-1',
      title: '民法',
      startTime: new Date('2026-09-20T02:00:00.000Z'),
      endTime: new Date('2026-09-20T03:30:00.000Z'),
      location: 'A101',
    };

    expect(courseReminderScheduledFor(event, preferences).toISOString())
      .toBe('2026-09-20T01:30:00.000Z');
    expect(shouldDeliverCourseReminder(
      event,
      preferences,
      new Date('2026-09-20T01:35:00.000Z'),
    )).toBe(true);
  });

  it('does not send a quiet-deferred course reminder after the class has started', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      courseReminderMinutes: 120,
      quietHoursEnabled: true,
      quietStart: '23:00',
      quietEnd: '07:00',
      timeZone: 'Asia/Shanghai',
    };
    const event = {
      id: 'course-event-quiet',
      userId: 'user-1',
      title: '早课',
      startTime: new Date('2026-09-19T22:30:00.000Z'), // 06:30
      endTime: new Date('2026-09-20T00:00:00.000Z'),
    };

    expect(shouldDeliverCourseReminder(
      event,
      preferences,
      new Date('2026-09-19T23:05:00.000Z'), // 07:05
    )).toBe(false);
  });

  it('builds distinct delivery keys by source type, source and subscription', () => {
    const scheduledFor = new Date('2026-09-20T01:30:00.000Z');
    const taskKey = buildNotificationDeliveryKey(
      'task',
      'user-1',
      'source-1',
      scheduledFor,
      'sub-1',
    );
    const courseKey = buildNotificationDeliveryKey(
      'course',
      'user-1',
      'source-1',
      scheduledFor,
      'sub-1',
    );

    expect(taskKey).not.toBe(courseKey);
    expect(courseKey).toContain('course');
  });
});
