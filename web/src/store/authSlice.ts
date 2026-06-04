import type { StateCreator } from 'zustand';
import type { ToggleableNavTab } from '../types';
import type { AppState } from './index';

const AUTH_STORAGE_KEY = 'sparkflow.authProfile';
const VALID_USERNAME = 'fish031';
const VALID_PASSWORD = '000000';

export type SparkFlowProfession =
  | 'student'
  | 'work'
  | 'developer'
  | 'research'
  | 'creator'
  | 'other';

export type SparkFlowStatusNeed =
  | 'study-focus'
  | 'internship-work'
  | 'dev-research'
  | 'project-shipping'
  | 'life-balance';

export interface SparkFlowProfile {
  displayName: string;
  profession: SparkFlowProfession;
  statusNeed: SparkFlowStatusNeed;
  navigationNeeds: ToggleableNavTab[];
}

interface StoredAuthProfile {
  isAuthenticated?: boolean;
  hasCompletedOnboarding?: boolean;
  profile?: Partial<SparkFlowProfile>;
}

const defaultProfile: SparkFlowProfile = {
  displayName: '',
  profession: 'student',
  statusNeed: 'study-focus',
  navigationNeeds: ['dashboard', 'tasks', 'calendar', 'courses', 'sparks'],
};

const allNavigationTabs: ToggleableNavTab[] = [
  'dashboard',
  'tasks',
  'board',
  'calendar',
  'courses',
  'sparks',
];

function normalizeProfile(profile?: Partial<SparkFlowProfile>): SparkFlowProfile {
  const navigationNeeds = Array.isArray(profile?.navigationNeeds)
    ? profile.navigationNeeds.filter((tab): tab is ToggleableNavTab =>
        allNavigationTabs.includes(tab as ToggleableNavTab),
      )
    : defaultProfile.navigationNeeds;

  return {
    displayName: profile?.displayName?.trim() ?? defaultProfile.displayName,
    profession: profile?.profession ?? defaultProfile.profession,
    statusNeed: profile?.statusNeed ?? defaultProfile.statusNeed,
    navigationNeeds: navigationNeeds.length > 0 ? navigationNeeds : defaultProfile.navigationNeeds,
  };
}

function readStoredAuth(): {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  profile: SparkFlowProfile;
} {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, hasCompletedOnboarding: false, profile: defaultProfile };
  }

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return { isAuthenticated: false, hasCompletedOnboarding: false, profile: defaultProfile };
    }

    const parsed = JSON.parse(raw) as StoredAuthProfile;
    return {
      isAuthenticated: parsed.isAuthenticated === true,
      hasCompletedOnboarding: parsed.hasCompletedOnboarding === true,
      profile: normalizeProfile(parsed.profile),
    };
  } catch {
    return { isAuthenticated: false, hasCompletedOnboarding: false, profile: defaultProfile };
  }
}

function writeStoredAuth(state: {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  profile: SparkFlowProfile;
}) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Keep the in-memory session usable when storage is unavailable.
  }
}

const storedAuth = readStoredAuth();

export interface AuthSlice {
  isAuthenticated: boolean;
  loginError: string | null;
  hasCompletedOnboarding: boolean;
  displayName: string;
  profession: SparkFlowProfession;
  statusNeed: SparkFlowStatusNeed;
  navigationNeeds: ToggleableNavTab[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  completeOnboarding: (profile: SparkFlowProfile) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: storedAuth.isAuthenticated,
  loginError: null,
  hasCompletedOnboarding: storedAuth.hasCompletedOnboarding,
  displayName: storedAuth.profile.displayName,
  profession: storedAuth.profile.profession,
  statusNeed: storedAuth.profile.statusNeed,
  navigationNeeds: storedAuth.profile.navigationNeeds,

  login: (username, password) => {
    const isValid = username.trim() === VALID_USERNAME && password === VALID_PASSWORD;

    if (!isValid) {
      set({ loginError: '账号或密码不正确' });
      return false;
    }

    const next = {
      isAuthenticated: true,
      hasCompletedOnboarding: get().hasCompletedOnboarding,
      profile: {
        displayName: get().displayName,
        profession: get().profession,
        statusNeed: get().statusNeed,
        navigationNeeds: get().navigationNeeds,
      },
    };

    writeStoredAuth(next);
    set({ isAuthenticated: true, loginError: null });
    return true;
  },

  logout: () => {
    const next = {
      isAuthenticated: false,
      hasCompletedOnboarding: get().hasCompletedOnboarding,
      profile: {
        displayName: get().displayName,
        profession: get().profession,
        statusNeed: get().statusNeed,
        navigationNeeds: get().navigationNeeds,
      },
    };

    writeStoredAuth(next);
    set({ isAuthenticated: false, loginError: null });
  },

  completeOnboarding: (profile) => {
    const normalized = normalizeProfile(profile);
    const next = {
      isAuthenticated: true,
      hasCompletedOnboarding: true,
      profile: normalized,
    };

    writeStoredAuth(next);
    set({
      isAuthenticated: true,
      loginError: null,
      hasCompletedOnboarding: true,
      displayName: normalized.displayName,
      profession: normalized.profession,
      statusNeed: normalized.statusNeed,
      navigationNeeds: normalized.navigationNeeds,
    });

    allNavigationTabs.forEach((tab) => {
      get().setNavVisibility(tab, normalized.navigationNeeds.includes(tab));
    });
  },
});
