/**
 * Push 通知 Slice
 *
 * Web Push API 订阅管理。
 * 依赖 VAPID 公钥从服务端获取 + Service Worker 注册。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import { apiRequest, DEFAULT_USER_ID } from '../api/client';

export interface PushSlice {
  /** 当前是否已订阅 */
  pushEnabled: boolean;
  /** 浏览器是否支持 Web Push */
  pushSupported: boolean;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  checkPushStatus: () => Promise<void>;
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

  checkPushStatus: async () => {
    if (!('serviceWorker' in navigator)) {
      set({ pushSupported: false, pushEnabled: false });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      set({ pushEnabled: !!sub, pushSupported: true });
    } catch {
      set({ pushSupported: false, pushEnabled: false });
    }
  },

  subscribeToPush: async () => {
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
            keys: {
              p256dh: subJson.keys!.p256dh,
              auth: subJson.keys!.auth,
            },
          },
        }),
      });

      set({ pushEnabled: true });
    } catch (err: any) {
      console.error('[Push] subscribe failed:', err.message);
      set({ pushEnabled: false });
    }
  },

  unsubscribeFromPush: async () => {
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
      set({ pushEnabled: false });
    } catch (err: any) {
      console.error('[Push] unsubscribe failed:', err.message);
    }
  },
});
