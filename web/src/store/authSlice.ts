import type { StateCreator } from 'zustand';
import type { ToggleableNavTab } from '../types';
import type { AppState } from './index';
import { isSupabaseConfigured, supabase } from '../api/supabase';
import { useCoursePreferences } from './coursePreferences';

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
const allNavigationTabs: ToggleableNavTab[] = [
  'dashboard', 'tasks', 'board', 'calendar', 'courses', 'sparks',
];
const defaultProfile: SparkFlowProfile = {
  displayName: '',
  professions: ['student'],
  statusNeeds: ['study-focus'],
  navigationNeeds: ['dashboard', 'tasks', 'calendar', 'courses', 'sparks'],
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
    ? raw.navigationNeeds.filter((v): v is ToggleableNavTab =>
        typeof v === 'string' && allNavigationTabs.includes(v as ToggleableNavTab))
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

function authErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) return '邮箱或密码不正确';
  if (lower.includes('email not confirmed')) return '请先在邮箱中确认注册邮件';
  if (lower.includes('user already registered')) return '该邮箱已经注册';
  if (lower.includes('password')) return '密码至少需要 6 个字符';
  return message || '认证服务暂时不可用';
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
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  setRegistering: (value: boolean) => void;
  completeOnboarding: (profile: SparkFlowProfile) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => {
  const applyUser = (user: { id: string; email?: string | null } | null) => {
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
    useCoursePreferences.getState().bindUser(user.id);
    set({
      authReady: true,
      isAuthenticated: true,
      currentUserId: user.id,
      currentEmail: user.email ?? null,
      hasCompletedOnboarding: stored.hasCompletedOnboarding,
      displayName: stored.profile.displayName,
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

    initializeAuth: async () => {
      if (initialized) return;
      initialized = true;
      if (!isSupabaseConfigured) {
        set({ authReady: true, loginError: '尚未配置 Supabase 登录环境变量' });
        return;
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) set({ authReady: true, loginError: authErrorMessage(error.message) });
      else applyUser(data.session?.user ?? null);
      supabase.auth.onAuthStateChange((_event, session) => applyUser(session?.user ?? null));
    },

    login: async (email, password) => {
      if (!isSupabaseConfigured) {
        set({ loginError: '尚未配置 Supabase 登录环境变量' });
        return false;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error || !data.user) {
        set({ loginError: authErrorMessage(error?.message || '') });
        return false;
      }
      applyUser(data.user);
      set({ loginError: null });
      return true;
    },

    logout: async () => {
      await supabase.auth.signOut();
      applyUser(null);
    },

    register: async (email, password) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        set({ registrationError: '请输入有效邮箱地址' });
        return false;
      }
      if (password.length < 6) {
        set({ registrationError: '密码至少需要 6 个字符' });
        return false;
      }
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (error) {
        set({ registrationError: authErrorMessage(error.message) });
        return false;
      }
      if (!data.session || !data.user) {
        set({ registrationError: '确认邮件已发送，请完成验证后再返回登录', isRegistering: true });
        return false;
      }
      applyUser(data.user);
      set({ registrationError: null, isRegistering: false });
      return true;
    },

    changePassword: async (oldPassword, newPassword) => {
      const email = get().currentEmail;
      if (!email || newPassword.length < 6) return false;
      const verified = await supabase.auth.signInWithPassword({ email, password: oldPassword });
      if (verified.error) return false;
      const result = await supabase.auth.updateUser({ password: newPassword });
      return !result.error;
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
      allNavigationTabs.forEach((tab) => get().setNavVisibility(tab, normalized.navigationNeeds.includes(tab)));
    },
  };
};
