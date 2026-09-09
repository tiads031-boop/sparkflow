import { create } from 'zustand';
import type { ScheduleBackup } from '../utils/courseSchedule';
import { fetchScheduleBackup } from '../api/courses';

export type CourseScheduleStatus = 'idle' | 'loading' | 'success' | 'error' | 'refreshing';
let activeRequest: AbortController | null = null;
let requestSequence = 0;
export const useCourseSchedule = create<{
  backup: ScheduleBackup | null; error: string; status: CourseScheduleStatus; refresh: () => Promise<void>;
}>()((set) => ({
  backup: null, error: '', status: 'idle',
  refresh: async () => {
    activeRequest?.abort();
    const controller = new AbortController();
    activeRequest = controller;
    const sequence = ++requestSequence;
    set(state => ({ status: state.backup ? 'refreshing' : 'loading', error: '' }));
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const backup = await fetchScheduleBackup(undefined, controller.signal);
      if (sequence === requestSequence) set({ backup, error: '', status: 'success' });
    } catch (e: unknown) {
      if (sequence !== requestSequence) return;
      const error = e instanceof DOMException && e.name === 'AbortError'
        ? '课程概览加载超时，请检查网络后重试'
        : (e instanceof Error ? e.message : '课表加载失败');
      set({ error, status: 'error' });
    } finally {
      clearTimeout(timeoutId);
      if (sequence === requestSequence) activeRequest = null;
    }
  },
}));
