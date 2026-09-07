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

function authErrorMessage(message: string, code?: string): string {
  const lower = message.toLowerCase();
  if (code === 'over_email_send_rate_limit' || lower.includes('email rate limit exceeded')) {
    return '注册邮件发送已达服务限额，请稍后再试；如果已收到确认邮件，请先完成验证再登录';
  }
  if (code === 'over_request_rate_limit' || lower.includes('rate limit') || lower.includes('security purposes')) {
    return '操作过于频繁，请稍后再试';
  }
  if (lower.includes('database error')) return '账号保存失败。如果刚提交过注册，请先检查确认邮件；否则请稍后重试或联系管理员';
  if (code === 'email_address_not_authorized') return '邮件服务暂不支持向此邮箱发送验证邮件，请联系管理员';
  if (code === 'email_address_invalid') return '请输入有效邮箱地址';
  if (lower.includes('fetch') || lower.includes('network')) return '连接认证服务失败，请检查网络后重试';
  if (lower.includes('invalid login credentials')) return '邮箱或密码不正确';
  if (lower.includes('email not confirmed')) return '请先在邮箱中确认注册邮件';
  if (lower.includes('user already registered')) return '该邮箱已经注册。请检查确认邮件，完成验证后直接登录';
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
  registrationPending: boolean;
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
  let confirmationEmailSentTo: string | null = null;
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
      if (!isSupabaseConfigured) {
        set({ authReady: true, loginError: '尚未配置 Supabase 登录环境变量' });
        return;
      }
      // Supabase puts confirmation failures in the URL hash. Consume them so
      // the app can explain the problem instead of leaving a broken route.
      if (typeof window !== 'undefined' && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const code = params.get('error_code');
        const description = params.get('error_description') || '';
        if (code || description) {
          const message = code === 'otp_expired' || description.toLowerCase().includes('expired')
            ? '确认链接已过期，请重新注册或联系管理员重新发送确认邮件'
            : '确认链接无效，请重新注册或联系管理员';
          set({ loginError: message });
          window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        }
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
      if (get().registrationPending) return false;
      if (!isSupabaseConfigured) {
        set({ registrationError: '尚未配置 Supabase 登录环境变量' });
        return false;
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        set({ registrationError: '请输入有效邮箱地址' });
        return false;
      }
      if (password.length < 6) {
        set({ registrationError: '密码至少需要 6 个字符' });
        return false;
      }
      // A successful signup without a session is awaiting email verification.
      // Repeating it cannot complete verification and consumes the email quota.
      if (confirmationEmailSentTo === normalizedEmail) {
        set({ registrationError: '确认邮件已发送，请完成验证后再返回登录', isRegistering: true });
        return false;
      }
      set({ registrationPending: true, registrationError: null });
      try {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
          },
        });
        if (error) {
          set({ registrationError: authErrorMessage(error.message, error.code) });
          return false;
        }
        if (!data.user) {
          set({ registrationError: '认证服务未返回账号信息，请稍后重试' });
          return false;
        }
        if (!data.session) {
          confirmationEmailSentTo = normalizedEmail;
          set({ registrationError: '确认邮件已发送，请完成验证后再返回登录', isRegistering: true });
          return false;
        }
        applyUser(data.user);
        set({ registrationError: null, isRegistering: false });
        return true;
      } catch (error) {
        set({ registrationError: authErrorMessage(error instanceof Error ? error.message : '') });
        return false;
      } finally {
        set({ registrationPending: false });
      }
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
