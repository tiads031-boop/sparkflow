/**
 * Capacitor 原生能力统一入口
 *
 * 仅在 Capacitor 运行时（Android APK）下可用。
 * 浏览器 / PWA 环境下调用这些方法会静默降级（返回 null/空），不会崩溃。
 *
 * 判断是否运行在 Capacitor 环境：
 *   import { isNative } from './capacitor';
 *   if (isNative()) { ... }
 */

export { listenToPushEvents, getPushToken, unregisterPush } from './push';
export {
  requestCalendarPermission,
  checkCalendarPermission,
  addToSystemCalendar,
  addToSystemCalendarWithPrompt,
  listSystemCalendarEvents,
  deleteSystemCalendarEvent,
} from './calendar';
export type { SystemCalendarEvent } from './calendar';

/** 检测当前是否运行在 Capacitor 原生环境（非浏览器 / PWA） */
export function isNative(): boolean {
  try {
    // Capacitor 会在 window 上挂载 Capacitor 对象
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

/** 获取当前平台标识 */
export function getPlatform(): 'web' | 'android' | 'ios' | 'unknown' {
  if (!isNative()) return 'web';
  try {
    const platform = (window as any).Capacitor?.getPlatform?.();
    return platform || 'unknown';
  } catch {
    return 'unknown';
  }
}
