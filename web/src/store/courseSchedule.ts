import { create } from 'zustand';
import type { ScheduleBackup } from '../utils/courseSchedule';
import { fetchScheduleBackup } from '../api/courses';

let pending: Promise<void> | undefined;
export const useCourseSchedule = create<{
  backup: ScheduleBackup | null; error: string; refresh: () => Promise<void>;
}>()((set) => ({
  backup: null, error: '',
  refresh: () => {
    if (pending) return pending;
    pending = fetchScheduleBackup().then(backup => { set({ backup, error: '' }); })
      .catch((e: unknown) => { set({ error: e instanceof Error ? e.message : '课表加载失败' }); })
      .finally(() => { pending = undefined; });
    return pending;
  },
}));
