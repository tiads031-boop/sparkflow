export interface UserPreferences {
  quadrantEnabled: boolean;
  defaultReminderMinutes: number;
}

const STORAGE_KEY = 'sparkflow.userPreferences';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  quadrantEnabled: true,
  defaultReminderMinutes: 30,
};

export function readUserPreferences(): UserPreferences {
  if (typeof window === 'undefined') return DEFAULT_USER_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      quadrantEnabled: parsed.quadrantEnabled !== false,
      defaultReminderMinutes:
        typeof parsed.defaultReminderMinutes === 'number' &&
        parsed.defaultReminderMinutes >= 0
          ? parsed.defaultReminderMinutes
          : DEFAULT_USER_PREFERENCES.defaultReminderMinutes,
    };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

export function writeUserPreferences(next: UserPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('sparkflow:preferences-changed', { detail: next }));
}

export function updateUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const next = { ...readUserPreferences(), ...patch };
  writeUserPreferences(next);
  return next;
}
