import { api } from './client';

export interface TimeTrackingPreferences {
  focusActualEnabled: boolean;
  quickStartEnabled: boolean;
  manualBackfillEnabled: boolean;
  defaultSceneId: string | null;
  focusAttachmentEnabled: boolean;
  externalSources: { androidUsage: 'not_connected' };
}

export type TimeTrackingPatch = Partial<Omit<TimeTrackingPreferences, 'externalSources'>>;

export function getTimeTrackingPreferences(signal?: AbortSignal) {
  return api.get<TimeTrackingPreferences>('/users/preferences/time-tracking', { signal, throwOnError: true });
}

export async function updateTimeTrackingPreferences(patch: TimeTrackingPatch) {
  const result = await api.patch<TimeTrackingPreferences>('/users/preferences/time-tracking', patch, { throwOnError: true });
  window.dispatchEvent(new CustomEvent('sparkflow:time-tracking-preferences-changed', { detail: result }));
  return result;
}
