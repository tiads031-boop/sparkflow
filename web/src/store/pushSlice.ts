/**
 * Push 通知 Slice
 *
 * **双通道**：
 * - **PWA / 浏览器**：Web Push API（VAPID + Service Worker）
 * - **Capacitor Android APK**：FCM 原生推送（@capacitor/push-notifications）
 *
 * 平台检测在运行时通过 window.Capacitor.isNativePlatform() 判断，
 * FCM 模块通过动态 import 加载（PWA 构建不会尝试打包原生模块）。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import { apiRequest, DEFAULT_USER_ID } from '../api/client';

export interface PushSlice {
  /** 当前是否已订阅 */
  pushEnabled: boolean;
  /** 当前平台是否支持推送 */
  pushSupported: boolean;
  /** 当前推送通道类型 */
  pushChannel: 'web' | 'fcm' | 'none';
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  checkPushStatus: () => Promise<void>;
}

// ── 平台检测 ──

function isCapacitorNative(): boolean {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** VAPID 公钥 Base64 URL-safe → Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export const createPushSlice: StateCreator<AppState, [], [], PushSlice> = (set) => ({
  pushEnabled: false,
  pushSupported: 'serviceWorker' in navigator && 'PushManager' in window,
  pushChannel: 'none',

  // ── 检查推送状态（双通道） ──

  checkPushStatus: async () => {
    // ── Capacitor FCM 通道 ──
    if (isCapacitorNative()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const permStatus = await PushNotifications.checkPermissions();
        set({
          pushSupported: true, // Android APK 始终支持 FCM
          pushEnabled: permStatus.receive === 'granted',
          pushChannel: permStatus.receive === 'granted' ? 'fcm' : 'none',
        });
      } catch {
        set({ pushSupported: true, pushEnabled: false, pushChannel: 'none' });
      }
      return;
    }

    // ── Web Push 通道 ──
    if (!('serviceWorker' in navigator)) {
      set({ pushSupported: false, pushEnabled: false, pushChannel: 'none' });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      set({ pushEnabled: !!sub, pushSupported: true, pushChannel: sub ? 'web' : 'none' });
    } catch {
      set({ pushSupported: false, pushEnabled: false, pushChannel: 'none' });
    }
  },

  // ── 订阅推送 ──

  subscribeToPush: async () => {
    // ── Capacitor FCM ──
    if (isCapacitorNative()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1. 请求权限
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') {
          console.warn('[Push] FCM 权限被用户拒绝');
          set({ pushEnabled: false });
          return;
        }

        // 2. 创建 Android 通知频道（Android 8+ 必须先建频道再注册，否则推送静默丢弃）
        try {
          await PushNotifications.createChannel({
            id: 'sparkflow-tasks',
            name: '任务提醒',
            description: '即将到期的任务推送通知',
            importance: 4,
            visibility: 1,
            lights: true,
            vibration: true,
          });
          await PushNotifications.createChannel({
            id: 'sparkflow-test',
            name: '推送测试',
            description: 'Sparkflow 推送诊断通道',
            importance: 4,
            visibility: 1,
            lights: true,
            vibration: true,
          });
          console.log('[Push] 通知频道已创建');
        } catch (e) {
          console.warn('[Push] 创建通知频道失败（可能已存在或平台不支持）:', e);
        }

        // 3. 注册 FCM
        await PushNotifications.register();

        // 4. 监听 registration token
        PushNotifications.addListener('registration', async (token) => {
          console.log('[Push] FCM token:', token.value);
          // 发送 token 到后端保存
          try {
            await apiRequest('/push/subscribe', {
              method: 'POST',
              body: JSON.stringify({
                userId: DEFAULT_USER_ID,
                subscription: {
                  endpoint: token.value,
                  channel: 'fcm',
                },
              }),
            });
          } catch (e) { console.error('[Push] 发送 FCM token 失败:', e); }
        });

        // 5. 监听注册失败
        PushNotifications.addListener('registrationError', (error) => {
          console.error('[Push] FCM 注册失败:', error);
          set({ pushEnabled: false, pushChannel: 'none' });
        });

        set({ pushEnabled: true, pushChannel: 'fcm' });
      } catch (err: any) {
        console.error('[Push] FCM 订阅失败:', err.message);
        set({ pushEnabled: false, pushChannel: 'none' });
      }
      return;
    }

    // ── Web Push ──
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] permission denied');
        return;
      }

      const keyRes = await apiRequest('/push/vapid-public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        console.error('[Push] VAPID public key not available');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON();
      await apiRequest('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          subscription: {
            endpoint: subJson.endpoint,
            channel: 'web',
            keys: {
              p256dh: subJson.keys!.p256dh,
              auth: subJson.keys!.auth,
            },
          },
        }),
      });

      set({ pushEnabled: true, pushChannel: 'web' });
    } catch (err: any) {
      console.error('[Push] subscribe failed:', err.message);
      set({ pushEnabled: false, pushChannel: 'none' });
    }
  },

  // ── 取消订阅 ──

  unsubscribeFromPush: async () => {
    // ── Capacitor FCM ──
    if (isCapacitorNative()) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.unregister();
        await apiRequest('/push/unsubscribe', {
          method: 'DELETE',
          body: JSON.stringify({ userId: DEFAULT_USER_ID, channel: 'fcm' }),
        });
      } catch (err: any) {
        console.error('[Push] FCM 注销失败:', err.message);
      }
      set({ pushEnabled: false, pushChannel: 'none' });
      return;
    }

    // ── Web Push ──
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await apiRequest('/push/unsubscribe', {
          method: 'DELETE',
          body: JSON.stringify({ userId: DEFAULT_USER_ID, endpoint: sub.endpoint }),
        });
      }
      set({ pushEnabled: false, pushChannel: 'none' });
    } catch (err: any) {
      console.error('[Push] unsubscribe failed:', err.message);
    }
  },
});
