import { api } from './client';

export interface AppUsageMapping {
  id: string;
  packageName: string;
  appName: string;
  tagId: string | null;
  tag: { name: string } | null;
  enabled: boolean;
}

export interface AppUsageSession {
  id: string;
  packageName: string;
  appName: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  tagName: string | null;
}

export interface AppUsageSettings {
  enabled: boolean;
  mappings: AppUsageMapping[];
}

export interface UsageInterval {
  packageName: string;
  startTime: string;
  endTime: string;
}

export const getAppUsageSettings = () => api.get<AppUsageSettings>('/app-usage/settings', { throwOnError: true });
export const setAppUsageEnabled = (enabled: boolean) => api.patch<AppUsageSettings>('/app-usage/settings', { enabled }, { throwOnError: true });
export const saveAppUsageMapping = (value: { packageName: string; appName: string; tagId: string | null; enabled: boolean }) =>
  api.post<AppUsageMapping>('/app-usage/mappings', value, { throwOnError: true });
export const deleteAppUsageMapping = (packageName: string) =>
  api.delete<{ removed: true }>(`/app-usage/mappings/${encodeURIComponent(packageName)}`, { throwOnError: true });
export const uploadAppUsage = (intervals: UsageInterval[]) =>
  api.post<{ inserted: number }>('/app-usage/sessions', { intervals }, { throwOnError: true });
export const getAppUsageSessions = (start: string, end: string) =>
  api.get<AppUsageSession[]>(`/app-usage/sessions?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { throwOnError: true });
