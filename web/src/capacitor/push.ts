/**
 * Capacitor FCM Push Notification 桥接层
 *
 * 与浏览器 Push API 不同，FCM 通过系统级服务推送，不依赖浏览器进程存活。
 * 红米 K70 上需确保：
 *   1. 开启"谷歌基础服务"（设置 → 帐号与同步 → 谷歌基础服务）
 *   2. Sparkflow 电池策略设为"无限制"
 *   3. 通知权限已授予
 */

import { PushNotifications } from '@capacitor/push-notifications';
import type { PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';

/**
 * 监听推送事件（前台消息 & 通知点击）
 *
 * 注意：FCM 注册流程（权限、频道创建、register、token 发送）已统一迁移至
 * store/pushSlice.ts 的 subscribeToPush()，本文件只保留与注册无关的被动事件监听。
 */
export async function listenToPushEvents(): Promise<void> {
  // 监听前台推送消息
  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('[Push] 收到推送:', notification.title, notification.body);
      // 可以在这里弹出本地通知或更新 UI 状态
    },
  );

  // 监听用户点击推送通知（冷启动或后台恢复）
  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action: ActionPerformed) => {
      console.log('[Push] 用户点击了通知:', action.notification);
      // 根据 action.notification.data 跳转到对应页面
    },
  );
}

/** 获取当前 FCM token（如果已注册） */
export async function getPushToken(): Promise<string | null> {
  try {
    // getDeliveredNotifications 不返回 token，这里仅做存在性检查
    await PushNotifications.getDeliveredNotifications();
    return null;
  } catch {
    return null;
  }
}

/** 注销 FCM 推送 */
export async function unregisterPush(): Promise<void> {
  await PushNotifications.unregister();
}

/*
 * createChannel 已迁移至 store/pushSlice.ts 的 subscribeToPush() 中，
 * 在 register() 之前调用，确保 Android 8+ 通知频道先于 FCM 注册就绪。
 *
 * 本文件只保留与注册无关的被动事件监听（前台消息 & 通知点击），
 * 由 App.tsx 在 Capacitor 原生平台初始化时调用 listenToPushEvents()。
 */
