import type { StateCreator } from 'zustand';
import type { ToggleableNavTab } from '../types';
import type { AppState } from './index';

const AUTH_STORAGE_KEY = 'sparkflow.authProfile';
const USERS_STORAGE_KEY = 'sparkflow.users';

// 内置默认账户
const DEFAULT_USERNAME = 'fish031';
// SHA-256("000000")
const DEFAULT_PASSWORD_HASH = 'e9abf91d2535662dc94f44029ba3c67209d034231e3c6f251b5c8cf8d7f3f5f8';

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
  /** v2：多选职业/身份列表 */
  professions: SparkFlowProfession[];
  /** v2：多选状态需求列表 */
  statusNeeds: SparkFlowStatusNeed[];
  navigationNeeds: ToggleableNavTab[];
}

interface RegisteredUser {
  username: string;
  passwordHash: string;
}

interface StoredAuthProfile {
  currentUser?: string;
  isAuthenticated?: boolean;
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

// ── 密码哈希 ──

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── 用户存储 ──

function getUsers(): RegisteredUser[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (u): u is RegisteredUser =>
        typeof u === 'object' &&
        u !== null &&
        typeof u.username === 'string' &&
        typeof u.passwordHash === 'string',
    );
  } catch {
    return [];
  }
}

function saveUsers(users: RegisteredUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // 静默降级
  }
}

async function verifyCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const trimmed = username.trim();
  if (!trimmed) return false;

  // 内置账户
  if (trimmed === DEFAULT_USERNAME) {
    const hash = await hashPassword(password);
    return hash === DEFAULT_PASSWORD_HASH;
  }

  // 注册用户
  const users = getUsers();
  const user = users.find((u) => u.username === trimmed);
  if (!user) return false;

  const hash = await hashPassword(password);
  return hash === user.passwordHash;
}

// ── Profile 标准化（兼容 v1 单值 → v2 数组） ──

function normalizeProfessions(raw: unknown): SparkFlowProfession[] {
  if (typeof raw === 'string' && allProfessions.includes(raw as SparkFlowProfession)) {
    return [raw as SparkFlowProfession];
  }
  if (Array.isArray(raw)) {
    return raw.filter((v): v is SparkFlowProfession =>
      typeof v === 'string' && allProfessions.includes(v as SparkFlowProfession),
    );
  }
  return defaultProfile.professions;
}

function normalizeStatusNeeds(raw: unknown): SparkFlowStatusNeed[] {
  if (typeof raw === 'string' && allStatusNeeds.includes(raw as SparkFlowStatusNeed)) {
    return [raw as SparkFlowStatusNeed];
  }
  if (Array.isArray(raw)) {
    return raw.filter((v): v is SparkFlowStatusNeed =>
      typeof v === 'string' && allStatusNeeds.includes(v as SparkFlowStatusNeed),
    );
  }
  return defaultProfile.statusNeeds;
}

function normalizeProfile(rawProfile?: Record<string, unknown>): SparkFlowProfile {
  const navigationNeeds = Array.isArray(rawProfile?.navigationNeeds)
    ? (rawProfile.navigationNeeds as string[]).filter((tab): tab is ToggleableNavTab =>
        allNavigationTabs.includes(tab as ToggleableNavTab),
      )
    : defaultProfile.navigationNeeds;

  // 兼容 v1 旧字段名 profession / statusNeed（单值），也支持 v2 新字段名
  const rawProfessions = rawProfile?.professions ?? rawProfile?.profession;
  const rawStatusNeeds = rawProfile?.statusNeeds ?? rawProfile?.statusNeed;

  return {
    displayName:
      typeof rawProfile?.displayName === 'string'
        ? rawProfile.displayName.trim()
        : defaultProfile.displayName,
    professions: normalizeProfessions(rawProfessions),
    statusNeeds: normalizeStatusNeeds(rawStatusNeeds),
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
    const profile = typeof parsed.profile === 'object' && parsed.profile !== null
      ? normalizeProfile(parsed.profile)
      : defaultProfile;

    return {
      isAuthenticated: parsed.isAuthenticated === true,
      hasCompletedOnboarding: parsed.hasCompletedOnboarding === true,
      profile,
    };
  } catch {
    return { isAuthenticated: false, hasCompletedOnboarding: false, profile: defaultProfile };
  }
}

function writeStoredAuth(state: {
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  profile: SparkFlowProfile;
}): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 静默降级
  }
}

const storedAuth = readStoredAuth();

// ── Slice 接口 ──

export interface AuthSlice {
  isAuthenticated: boolean;
  loginError: string | null;
  hasCompletedOnboarding: boolean;
  displayName: string;
  professions: SparkFlowProfession[];
  statusNeeds: SparkFlowStatusNeed[];
  navigationNeeds: ToggleableNavTab[];
  /** 当前是否在注册模式 */
  isRegistering: boolean;
  /** 注册错误消息 */
  registrationError: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (username: string, password: string) => Promise<boolean>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<boolean>;
  setRegistering: (value: boolean) => void;
  completeOnboarding: (profile: SparkFlowProfile) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set, get) => ({
  isAuthenticated: storedAuth.isAuthenticated,
  loginError: null,
  hasCompletedOnboarding: storedAuth.hasCompletedOnboarding,
  displayName: storedAuth.profile.displayName,
  professions: storedAuth.profile.professions,
  statusNeeds: storedAuth.profile.statusNeeds,
  navigationNeeds: storedAuth.profile.navigationNeeds,
  isRegistering: false,
  registrationError: null,

  login: async (username, password) => {
    const isValid = await verifyCredentials(username, password);

    if (!isValid) {
      set({ loginError: '账号或密码不正确' });
      return false;
    }

    const state = get();
    const next = {
      isAuthenticated: true,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      profile: {
        displayName: state.displayName,
        professions: state.professions,
        statusNeeds: state.statusNeeds,
        navigationNeeds: state.navigationNeeds,
      },
    };

    writeStoredAuth(next);
    set({ isAuthenticated: true, loginError: null });
    return true;
  },

  logout: () => {
    const state = get();
    const next = {
      isAuthenticated: false,
      hasCompletedOnboarding: state.hasCompletedOnboarding,
      profile: {
        displayName: state.displayName,
        professions: state.professions,
        statusNeeds: state.statusNeeds,
        navigationNeeds: state.navigationNeeds,
      },
    };

    writeStoredAuth(next);
    set({ isAuthenticated: false, loginError: null });
  },

  register: async (username, password) => {
    const trimmed = username.trim();

    if (trimmed.length < 2 || trimmed.length > 20) {
      set({ registrationError: '用户名需要 2-20 个字符' });
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      set({ registrationError: '用户名只能包含字母、数字和下划线' });
      return false;
    }
    if (password.length < 6) {
      set({ registrationError: '密码至少需要 6 个字符' });
      return false;
    }

    // 检查是否与内置账户冲突
    if (trimmed === DEFAULT_USERNAME) {
      set({ registrationError: '该用户名已被占用' });
      return false;
    }

    const users = getUsers();
    if (users.some((u) => u.username === trimmed)) {
      set({ registrationError: '该用户名已被注册' });
      return false;
    }

    const passwordHash = await hashPassword(password);
    users.push({ username: trimmed, passwordHash });
    saveUsers(users);

    // 注册成功，自动登录 → 进问候页
    const next = {
      isAuthenticated: true,
      hasCompletedOnboarding: false,
      profile: defaultProfile,
    };

    writeStoredAuth(next);
    set({
      isAuthenticated: true,
      loginError: null,
      registrationError: null,
      isRegistering: false,
      hasCompletedOnboarding: false,
      displayName: defaultProfile.displayName,
      professions: defaultProfile.professions,
      statusNeeds: defaultProfile.statusNeeds,
      navigationNeeds: defaultProfile.navigationNeeds,
    });
    return true;
  },

  changePassword: async (oldPassword, newPassword) => {
    if (newPassword.length < 6) return false;

    const users = getUsers();
    const oldHash = await hashPassword(oldPassword);

    // 内置账户：旧密码正确 → 首次改密时迁移到注册用户表
    if (oldHash === DEFAULT_PASSWORD_HASH) {
      const newHash = await hashPassword(newPassword);
      const others = users.filter((u) => u.username !== DEFAULT_USERNAME);
      others.push({ username: DEFAULT_USERNAME, passwordHash: newHash });
      saveUsers(others);
      return true;
    }

    // 注册用户
    const user = users.find((u) => u.username === DEFAULT_USERNAME);
    if (!user || user.passwordHash !== oldHash) {
      return false;
    }

    const newHash = await hashPassword(newPassword);
    const updated = users.map((u) =>
      u.username === DEFAULT_USERNAME ? { ...u, passwordHash: newHash } : u,
    );
    saveUsers(updated);
    return true;
  },

  setRegistering: (value) => {
    set({ isRegistering: value, registrationError: null });
  },

  completeOnboarding: (profile) => {
    // 直接使用传入的 profile（已是 v2 格式），但保险起见做一次 normalize
    const normalized: SparkFlowProfile = {
      displayName: profile.displayName?.trim() || defaultProfile.displayName,
      professions: normalizeProfessions(profile.professions),
      statusNeeds: normalizeStatusNeeds(profile.statusNeeds),
      navigationNeeds: Array.isArray(profile.navigationNeeds)
        ? profile.navigationNeeds.filter((tab) =>
            allNavigationTabs.includes(tab as ToggleableNavTab),
          )
        : defaultProfile.navigationNeeds,
    };

    if (normalized.navigationNeeds.length === 0) {
      normalized.navigationNeeds = defaultProfile.navigationNeeds;
    }

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
      professions: normalized.professions,
      statusNeeds: normalized.statusNeeds,
      navigationNeeds: normalized.navigationNeeds,
    });

    allNavigationTabs.forEach((tab) => {
      get().setNavVisibility(tab, normalized.navigationNeeds.includes(tab));
    });
  },
});
