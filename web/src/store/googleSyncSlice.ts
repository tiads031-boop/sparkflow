/**
 * Google Calendar 同步 Slice
 *
 * 管理 Google OAuth 授权状态、同步状态和手动同步操作。
 * 前端不接触 access_token / refresh_token，只通过后端 API 交互。
 *
 * **双环境 OAuth 流程**：
 * - **PWA / 浏览器**：window.open 弹窗 → 轮询检测关闭 → checkStatus 确认
 * - **Capacitor Android**：优先用 @capacitor/browser 打开系统浏览器 →
 *   通过 @capacitor/app 的 appUrlOpen 监听 deep link 回调，
 *   或用户手动返回 APP 时由 App.tsx 的 appStateChange 触发 checkStatus
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import { api, DEFAULT_USER_ID } from '../api/client';

// ── 类型 ──

export interface GoogleSyncState {
  /** 是否已授权 Google 账号 */
  isConnected: boolean;
  /** 已连接的 Google 邮箱 */
  googleEmail: string | null;
  /** 上次同步时间 (ISO 字符串) */
  lastSyncAt: string | null;
  /** 已同步事件数 */
  syncedCount: number;
  /** 正在授权中（弹窗已打开） */
  isConnecting: boolean;
  /** 正在同步中 */
  isSyncing: boolean;
  /** 错误信息 */
  error: string | null;
}

export interface GoogleSyncSlice extends GoogleSyncState {
  /** 发起 Google OAuth 授权流程 */
  connectGoogle: () => Promise<void>;
  /** 断开 Google 账号连接 */
  disconnectGoogle: () => Promise<void>;
  /** 手动触发同步 */
  syncNow: () => Promise<void>;
  /** 检查当前 Google 连接状态 */
  checkStatus: () => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
}

// ── API 响应类型 ──

interface AuthUrlResponse {
  url: string;
}

interface SyncStatusResponse {
  isConnected: boolean;
  googleEmail: string | null;
  lastSyncAt: string | null;
  syncedCount: number;
}

// ── 模块级变量（弹出窗口引用，不放入 store state） ──

let popupRef: Window | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// ── 平台检测（内联，避免原生模块 import 导致 PWA 构建失败） ──

function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

function getOAuthPlatform(): 'android' | 'web' {
  return isCapacitorNative() ? 'android' : 'web';
}

function withDefaultUser(path: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ userId: DEFAULT_USER_ID, ...(extra || {}) });
  return `${path}?${params.toString()}`;
}

function isSparkFlowOAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'sparkflow:' && parsed.hostname === 'oauth';
  } catch {
    return false;
  }
}

function getOAuthStatus(url: string): string | null {
  try {
    return new URL(url).searchParams.get('status');
  } catch {
    return null;
  }
}

/** 清理 OAuth 轮询 + popup 引用 */
function cleanupOAuthState() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  popupRef = null;
}

// ── Slice 创建 ──

export const createGoogleSyncSlice: StateCreator<AppState, [], [], GoogleSyncSlice> = (
  set,
  get,
) => ({
  // ── 初始状态 ──
  isConnected: false,
  googleEmail: null,
  lastSyncAt: null,
  syncedCount: 0,
  isConnecting: false,
  isSyncing: false,
  error: null,

  // ── 检查连接状态 ──

  checkStatus: async () => {
    try {
      const data = await api.get<SyncStatusResponse>(withDefaultUser('/google/status'), {
        fallback: {
          isConnected: false,
          googleEmail: null,
          lastSyncAt: null,
          syncedCount: 0,
        },
      });
      set({
        isConnected: data.isConnected ?? false,
        googleEmail: data.googleEmail ?? null,
        lastSyncAt: data.lastSyncAt ?? null,
        syncedCount: data.syncedCount ?? 0,
        error: null,
      });
    } catch (err: any) {
      console.warn('[GoogleSync] checkStatus failed:', err.message);
    }
  },

  // ── 连接 Google ──

  connectGoogle: async () => {
    cleanupOAuthState();
    set({ isConnecting: true, error: null });

    try {
      const finishOAuthFlow = async (callbackUrl?: string) => {
        if (callbackUrl && getOAuthStatus(callbackUrl) !== 'success') {
          cleanupOAuthState();
          set({ isConnecting: false, error: 'Google 授权未完成，请重试' });
          return;
        }

        cleanupOAuthState();
        await get().checkStatus();
        const state = get();
        if (!state.isConnected) {
          set({ isConnecting: false, error: 'Google 授权未完成，请重试' });
          return;
        }

        set({ isConnecting: false });
        await get().syncNow();
      };

      // 1. 获取 Google OAuth 授权 URL
      const { url } = await api.get<AuthUrlResponse>(
        withDefaultUser('/google/auth/url', { platform: getOAuthPlatform() }),
        { throwOnError: true },
      );

      if (!url) {
        throw new Error('无法获取 Google 授权链接');
      }

      // ── Capacitor 环境：用系统浏览器打开 + deep link 回调 ──
      if (isCapacitorNative()) {
        // 先尝试用 @capacitor/browser 打开（体验更好）
        let browserOpened = false;
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url, presentationStyle: 'popover' });
          browserOpened = true;

          // 注册 deep link 回调监听
          try {
            const { App: CapApp } = await import('@capacitor/app');
            const handler = await CapApp.addListener('appUrlOpen', async (event) => {
              console.log('[GoogleSync] appUrlOpen deep link:', event.url);
              if (!isSparkFlowOAuthCallback(event.url)) return;
              // deep link 回调到达 → 关闭浏览器 → 检查连接状态 → 同步
              await Browser.close().catch(() => {});
              handler.remove();
              await finishOAuthFlow(event.url);
            });
          } catch {
            // @capacitor/app 不可用，走轮询降级
          }
        } catch {
          // @capacitor/browser 不可用，走 window.open 降级
        }

        if (!browserOpened) {
          // 降级：window.open
          popupRef = window.open(url, '_blank');
        }

        // Capacitor 环境：启动轮询（2 秒间隔），深层因为系统浏览器和 APP 之间
        // 切换可能较慢，比 PWA 的 800ms 间隔更长
        pollTimer = setInterval(async () => {
          // 检查 popup 是否还在（window.open 降级时）
          if (popupRef && !popupRef.closed) return;

          // popup 已关闭或 Browser 模式，直接检查状态
          await get().checkStatus();
          const state = get();
          if (state.isConnected) {
            await finishOAuthFlow();
          }
        }, 2000);

        // 安全超时：2 分钟后强制终止
        setTimeout(() => {
          if (get().isConnecting) {
            cleanupOAuthState();
            set({ isConnecting: false, error: '授权超时，请重试' });
          }
        }, 120_000);

        return;
      }

      // ── PWA / 浏览器环境：window.open 弹窗 ──
      const w = 600;
      const h = 700;
      const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
      const top = Math.round(window.screenY + (window.outerHeight - h) / 2);

      popupRef = window.open(
        url,
        'google-oauth',
        `width=${w},height=${h},left=${left},top=${top},scrollbars=yes`,
      );

      if (!popupRef) {
        set({
          isConnecting: false,
          error: '弹窗被浏览器拦截，请允许此站点的弹窗后重试',
        });
        return;
      }

      // 轮询检测弹窗关闭
      pollTimer = setInterval(async () => {
        if (!popupRef || popupRef.closed) {
          await finishOAuthFlow();
        }
      }, 800);
    } catch (err: any) {
      cleanupOAuthState();
      set({
        isConnecting: false,
        error: err.message || '连接 Google 失败',
      });
    }
  },

  // ── 断开连接 ──

  disconnectGoogle: async () => {
    try {
      await api.post('/google/disconnect', { userId: DEFAULT_USER_ID }, { throwOnError: true });
      set({
        isConnected: false,
        googleEmail: null,
        lastSyncAt: null,
        syncedCount: 0,
        error: null,
      });
    } catch (err: any) {
      set({ error: err.message || '断开连接失败' });
    }
  },

  // ── 手动同步 ──

  syncNow: async () => {
    set({ isSyncing: true, error: null });

    try {
      const data = await api.post<SyncStatusResponse>(
        '/google/sync',
        { userId: DEFAULT_USER_ID },
        { throwOnError: true },
      );

      set({
        isSyncing: false,
        lastSyncAt: data?.lastSyncAt ?? new Date().toISOString(),
        syncedCount: data?.syncedCount ?? 0,
      });
      await get().checkStatus();
      await get().loadTasks?.();
    } catch (err: any) {
      set({
        isSyncing: false,
        error: err.message || '同步失败，请稍后重试',
      });
    }
  },

  // ── 清除错误 ──

  clearError: () => set({ error: null }),
});
