import { Capacitor, registerPlugin } from '@capacitor/core';
import type { UsageInterval } from '../api/appUsage';

interface AppUsageNative {
  status(): Promise<{ granted: boolean }>;
  openSettings(): Promise<void>;
  discover(): Promise<{ apps: Array<{ packageName: string; appName: string }> }>;
  query(input: { start: number; end: number; packages: string[] }): Promise<{ intervals: UsageInterval[] }>;
}

const native = registerPlugin<AppUsageNative>('AppUsage');

export function isAndroidUsageAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isNativePlatform();
}

export const androidUsage = {
  status: () => native.status(),
  openSettings: () => native.openSettings(),
  discover: () => native.discover(),
  query: (input: { start: number; end: number; packages: string[] }) => native.query(input),
};
