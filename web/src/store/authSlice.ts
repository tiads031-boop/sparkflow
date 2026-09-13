import type { StateCreator } from 'zustand';
import type { ToggleableNavTab } from '../types';
import type { AppState } from './index';
import { api } from '../api/client';
import { clearAccessToken, setAccessToken, type AuthUser } from '../api/auth';
import { useCoursePreferences } from './coursePreferences';
import { defaultNavVisibility, isToggleableNavTab, migrateNavigationId, toggleableNavTabs } from '../navigation';
import { normalizeNickname, validateNickname, type AuthMethod } from '../auth/credentials';

const PROFILE_STORAGE_PREFIX = 'sparkflow.authProfile.v2';

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
  professions: SparkFlowProfession[];
  statusNeeds: SparkFlowStatusNeed[];
  navigationNeeds: ToggleableNavTab[];
}

interface StoredProfile {
  hasCompletedOnboarding?: boolean;
  profile?: Record<string, unknown>;
}

const allProfessions: SparkFlowProfession[] = [
  'student', 'work', 'developer', 'research', 'creator', 'other',
];
const allStatusNeeds: SparkFlowStatusNeed[] = [
  'study-focus', 'internship-work', 'dev-research', 'project-shipping', 'life-balance',
];
const defaultProfile: SparkFlowProfile = {
  displayName: '',
  professions: ['student'],
  statusNeeds: ['study-focus'],
  navigationNeeds: toggleableNavTabs.filter((tab) => defaultNavVisibility[tab]),
};

function normalizeProfile(raw?: Record<string, unknown>): SparkFlowProfile {
  const professions = Array.isArray(raw?.professions)
    ? raw.professions.filter((v): v is SparkFlowProfession =>
        typeof v === 'string' && allProfessions.includes(v as SparkFlowProfession))
    : defaultProfile.professions;
  const statusNeeds = Array.isArray(raw?.statusNeeds)
    ? raw.statusNeeds.filter((v): v is SparkFlowStatusNeed =>
        typeof v === 'string' && allStatusNeeds.includes(v as SparkFlowStatusNeed))
    : defaultProfile.statusNeeds;
  const navigationNeeds = Array.isArray(raw?.navigationNeeds)
    ? raw.navigationNeeds.map(migrateNavigationId).filter(isToggleableNavTab)
    : defaultProfile.navigationNeeds;
  return {
    displayName: typeof raw?.displayName === 'string' ? raw.displayName.trim() : '',
    professions: professions.length ? professions : defaultProfile.professions,
    statusNeeds: statusNeeds.length ? statusNeeds : defaultProfile.statusNeeds,
    navigationNeeds: navigationNeeds.length ? navigationNeeds : defaultProfile.navigationNeeds,
  };
}

function profileKey(userId: string) {
  return `${PROFILE_STORAGE_PREFIX}.${userId}`;
}

function readProfile(userId: string): { hasCompletedOnboarding: boolean; profile: SparkFlowProfile } {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileKey(userId)) || '{}') as StoredProfile;
    return {
      hasCompletedOnboarding: parsed.hasCompletedOnboarding === true,
      profile: normalizeProfile(parsed.profile),
    };
  } catch {
    return { hasCompletedOnboarding: false, profile: defaultProfile };
  }
}

function writeProfile(userId: string, hasCompletedOnboarding: boolean, profile: SparkFlowProfile) {
  localStorage.setItem(profileKey(userId), JSON.stringify({ hasCompletedOnboarding, profile }));
}

function authErrorMessage(message: string, method: AuthMethod = 'email'): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate_limited') || lower.includes('429')) {
    return '操作过于频繁，请稍后再试';
  }
  if (lower.includes('nickname_taken')) return '这个昵称已经被使用';
  if (lower.includes('email_taken')) return '该邮箱已经注册';
  if (lower.includes('invalid_nickname')) return '昵称只能包含 2–24 个文字、数字、点、横线或下划线';
  if (lower.includes('invalid_email')) return '请输入有效邮箱地址';
  if (lower.includes('invalid_current_password')) return '当前密码不正确';
  if (lower.includes('invalid_credentials') || lower.includes('401')) {
    return `${method === 'nickname' ? '昵称' : '邮箱'}或密码不正确`;
  }
  if (lower.includes('fetch') || lower.includes('network')) return '连接认证服务失败，请检查网络后重试';
  if (lower.includes('password')) return '密码至少需要 6 个字符';
  return '认证服务暂时不可用';
}

export interface AuthSlice {
  authReady: boolean;
  isAuthenticated: boolean;
  currentUserId: string | null;
  currentEmail: string | null;
  loginError: string | null;
  hasCompletedOnboarding: boolean;
  displayName: string;
  professions: SparkFlowProfession[];
  statusNeeds: SparkFlowStatusNeed[];
  navigationNeeds: ToggleableNavTab[];
  isRegistering: boolean;
  registrationError: string | null;
  registrationPending: boolean;
  initializeAuth: () => Promise<void>;
  login: (identifier: string, password: string, method: AuthMethod) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (identifier: string, password: string, method: AuthMethod) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  setRegistering: (value: boolean) => void;
  completeOnboarding: (profile: SparkFlowProfile) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => {
  const applyUser = (user: AuthUser | null) => {
    if (!user) {
      useCoursePreferences.getState().bindUser(null);
      set({
        authReady: true,
        isAuthenticated: false,
        currentUserId: null,
        currentEmail: null,
        hasCompletedOnboarding: false,
        displayName: '',
        professions: defaultProfile.professions,
        statusNeeds: defaultProfile.statusNeeds,
        navigationNeeds: defaultProfile.navigationNeeds,
        tasks: [], courses: [], semesters: [], events: [],
      });
      return;
    }
    const stored = readProfile(user.id);
    const accountNickname = user.nickname?.trim() || '';
    useCoursePreferences.getState().bindUser(user.id);
    set({
      authReady: true,
      isAuthenticated: true,
      currentUserId: user.id,
      currentEmail: user.email ?? null,
      hasCompletedOnboarding: stored.hasCompletedOnboarding,
      displayName: stored.profile.displayName || accountNickname,
      professions: stored.profile.professions,
      statusNeeds: stored.profile.statusNeeds,
      navigationNeeds: stored.profile.navigationNeeds,
      tasks: [], courses: [], semesters: [], events: [],
    });
  };

  let initialized = false;
  return {
    authReady: false,
    isAuthenticated: false,
    currentUserId: null,
    currentEmail: null,
    loginError: null,
    hasCompletedOnboarding: false,
    displayName: '',
    professions: defaultProfile.professions,
    statusNeeds: defaultProfile.statusNeeds,
    navigationNeeds: defaultProfile.navigationNeeds,
    isRegistering: false,
    registrationError: null,
    registrationPending: false,

    initializeAuth: async () => {
      if (initialized) return;
      initialized = true;
      try {
        const result = await api.get<{ user: AuthUser }>('/auth/session', { throwOnError: true });
        applyUser(result.user);
      } catch {
        clearAccessToken();
        applyUser(null);
      }
    },

    login: async (identifier, password, method) => {
      if (method === 'nickname') {
        const nicknameError = validateNickname(identifier);
        if (nicknameError) {
          set({ loginError: nicknameError });
          return false;
        }
      }
      try {
        const result = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
          method,
          identifier: method === 'nickname' ? normalizeNickname(identifier) : identifier.trim().toLowerCase(),
          password,
        }, { throwOnError: true });
        setAccessToken(result.token);
        applyUser(result.user);
        set({ loginError: null });
        return true;
      } catch (error) {
        set({ loginError: authErrorMessage(error instanceof Error ? error.message : '', method) });
        return false;
      }
    },

    logout: async () => {
      try {
        await api.post('/auth/logout', undefined, { throwOnError: true });
      } finally {
        clearAccessToken();
        applyUser(null);
      }
    },

    register: async (identifier, password, method) => {
      if (get().registrationPending) return false;
      if (method === 'nickname') {
        const nicknameError = validateNickname(identifier);
        if (nicknameError) {
          set({ registrationError: nicknameError });
          return false;
        }
      }
      const normalizedIdentifier = method === 'nickname'
        ? normalizeNickname(identifier)
        : identifier.trim().toLowerCase();
      if (method === 'email' && !/^\S+@\S+\.\S+$/.test(normalizedIdentifier)) {
        set({ registrationError: '请输入有效邮箱地址' });
        return false;
      }
      if (password.length < 6) {
        set({ registrationError: '密码至少需要 6 个字符' });
        return false;
      }
      set({ registrationPending: true, registrationError: null });
      try {
        const result = await api.post<{ token: string; user: AuthUser }>('/auth/register', {
          method,
          identifier: normalizedIdentifier,
          password,
        }, { throwOnError: true });
        setAccessToken(result.token);
        applyUser(result.user);
        set({ registrationError: null, isRegistering: false });
        return true;
      } catch (error) {
        set({ registrationError: authErrorMessage(error instanceof Error ? error.message : '', method) });
        return false;
      } finally {
        set({ registrationPending: false });
      }
    },

    changePassword: async (oldPassword, newPassword) => {
      if (!get().currentUserId || newPassword.length < 6) return false;
      try {
        const result = await api.post<{ token: string; user: AuthUser }>('/auth/change-password', {
          oldPassword,
          newPassword,
        }, { throwOnError: true });
        setAccessToken(result.token);
        return true;
      } catch {
        return false;
      }
    },

    setRegistering: (value) => set({ isRegistering: value, registrationError: null, loginError: null }),

    completeOnboarding: (profile) => {
      const userId = get().currentUserId;
      if (!userId) return;
      const normalized = normalizeProfile(profile as unknown as Record<string, unknown>);
      writeProfile(userId, true, normalized);
      set({
        hasCompletedOnboarding: true,
        displayName: normalized.displayName,
        professions: normalized.professions,
        statusNeeds: normalized.statusNeeds,
        navigationNeeds: normalized.navigationNeeds,
      });
      toggleableNavTabs.forEach((tab) => get().setNavVisibility(tab, normalized.navigationNeeds.includes(tab)));
    },
  };
};
