import { create } from 'zustand';

type PreferenceValues = {
  theme: 'system' | 'light' | 'dark';
  widget: 'next' | 'today' | 'twoDays';
  reminders: boolean;
  leadMinutes: number;
  skippedDates: string[];
  autoHolidays: boolean;
  holidayCache: Record<string, { dates: string[]; fetchedAt: string }>;
  autoMode: 'off' | 'dnd' | 'silent';
};

interface CoursePreferences extends PreferenceValues {
  ownerId: string | null;
  bindUser: (userId: string | null) => void;
  setPreferences: (patch: Partial<PreferenceValues>) => void;
}

const defaults: PreferenceValues = {
  theme: 'system',
  widget: 'twoDays',
  reminders: false,
  leadMinutes: 10,
  skippedDates: [],
  autoHolidays: false,
  holidayCache: {},
  autoMode: 'off',
};

function storageKey(userId: string) {
  return `sparkflow-course-preferences-v2.${userId}`;
}

function readPreferences(userId: string): PreferenceValues {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') as Partial<PreferenceValues>;
    return { ...defaults, ...raw };
  } catch {
    return defaults;
  }
}

export const useCoursePreferences = create<CoursePreferences>()((set, get) => ({
  ...defaults,
  ownerId: null,
  bindUser: (userId) => set({ ...(userId ? readPreferences(userId) : defaults), ownerId: userId }),
  setPreferences: (patch) => {
    set(patch);
    const ownerId = get().ownerId;
    if (!ownerId) return;
    const state = get();
    const saved: PreferenceValues = {
      theme: state.theme,
      widget: state.widget,
      reminders: state.reminders,
      leadMinutes: state.leadMinutes,
      skippedDates: state.skippedDates,
      autoHolidays: state.autoHolidays,
      holidayCache: state.holidayCache,
      autoMode: state.autoMode,
    };
    localStorage.setItem(storageKey(ownerId), JSON.stringify(saved));
  },
}));
