export type AppearancePreference = 'system' | 'light' | 'dark';

export interface UserPreferences {
  quadrantEnabled: boolean;
  defaultReminderMinutes: number;
  appearance: AppearancePreference;
}

const STORAGE_KEY = 'sparkflow.userPreferences';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  quadrantEnabled: true,
  defaultReminderMinutes: 30,
  appearance: 'system',
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
      appearance:
        parsed.appearance === 'light' || parsed.appearance === 'dark'
          ? parsed.appearance
          : 'system',
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


export function resolvedAppearance(
  preference: AppearancePreference = readUserPreferences().appearance,
): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyAppearancePreference(
  preference: AppearancePreference = readUserPreferences().appearance,
) {
  if (typeof document === 'undefined') return resolvedAppearance(preference);
  const resolved = resolvedAppearance(preference);
  document.documentElement.dataset.sfTheme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}
