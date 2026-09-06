import { useEffect } from 'react';
import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { useCoursePreferences } from '../store/coursePreferences';
import { useCourseSchedule } from '../store/courseSchedule';
import { fetchHolidays } from '../api/courseIntegrations';
import { CourseAutomation } from '../api/courseNative';
import { occurrences } from '../utils/courseSchedule';
import { automationWindows, chinaDay } from '../utils/courseAutomation';
export const useIntegrationStatus = create<{ holidayError: string; automationError: string }>(() => ({ holidayError: '', automationError: '' }));
let holidayPending: Promise<void> | null = null;
let retryAfter = 0;
export function refreshAutomaticHolidays(force = false) {
  if (holidayPending) return holidayPending;
  if (!force && Date.now() < retryAfter) return Promise.resolve();
  holidayPending = (async () => {
    const state = useCoursePreferences.getState();
    const backup = useCourseSchedule.getState().backup;
    const current = Number(chinaDay(new Date().toISOString()).slice(0, 4));
    const years = new Set([current, ...(backup ? occurrences(backup).map(e => Number(chinaDay(e.startTime).slice(0, 4))).filter(y => y >= current && y <= current + 1) : [])]);
    const errors: string[] = [];
    for (const year of years) {
      const cached = state.holidayCache[year];
      if (!force && cached && Date.now() - Date.parse(cached.fetchedAt) < 86400000) continue;
      try {
        const result = await fetchHolidays(year);
        const prefs = useCoursePreferences.getState();
        prefs.setPreferences({ holidayCache: { ...prefs.holidayCache, [year]: { dates: result.dates, fetchedAt: result.fetchedAt } } });
        if (result.stale) errors.push(`${year} 年正在使用上次缓存`);
      } catch (e) { errors.push(e instanceof Error ? e.message : `${year} 年数据更新失败`); }
    }
    useIntegrationStatus.setState({ holidayError: errors.join('；') });
    retryAfter = errors.length ? Date.now() + 3600000 : 0;
  })().finally(() => { holidayPending = null; });
  return holidayPending;
}
let automationQueue = Promise.resolve();
let signature = '';
export default function CourseIntegrationsRuntime() {
  const { backup } = useCourseSchedule();
  const { autoHolidays, holidayCache, skippedDates, autoMode } = useCoursePreferences();
  useEffect(() => {
    if (!autoHolidays) return;
    void refreshAutomaticHolidays();
    const timer = setInterval(() => void refreshAutomaticHolidays(), 3600000);
    return () => clearInterval(timer);
  }, [autoHolidays, backup]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || (!backup && autoMode !== 'off')) return;
    const windows = automationWindows(backup ? occurrences(backup) : [], skippedDates, autoHolidays ? Object.values(holidayCache).flatMap(h => h.dates) : []);
    const key = JSON.stringify([autoMode, windows]);
    automationQueue = automationQueue.then(async () => {
      if (signature === key) return;
      await CourseAutomation.sync({ mode: autoMode, windows });
      signature = key; useIntegrationStatus.setState({ automationError: '' });
    }).catch(e => useIntegrationStatus.setState({ automationError: e instanceof Error ? e.message : '上课自动模式同步失败' }));
  }, [backup, autoMode, autoHolidays, holidayCache, skippedDates]);
  return null;
}
