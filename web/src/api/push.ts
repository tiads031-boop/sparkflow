import { api } from './client';

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

export function getNotificationPreferences() {
  return api.get<NotificationPreferences>('/push/preferences', {
    throwOnError: true,
  });
}

export function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
) {
  return api.patch<NotificationPreferences>(
    '/push/preferences',
    patch,
    { throwOnError: true },
  );
}
