/**
 * Semester 数据 Slice
 *
 * 学期列表、当前选中学期状态管理。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Semester } from '../types';
import {
  fetchSemesters,
  createSemester as apiCreateSemester,
  updateSemester as apiUpdateSemester,
  deleteSemester as apiDeleteSemester,
} from '../api/semesters';

export interface SemesterSlice {
  // ── 状态 ──
  semesters: Semester[];
  activeSemesterId: string | null;
  isSemestersLoading: boolean;

  // ── 操作 ──
  loadSemesters: () => Promise<void>;
  setActiveSemester: (id: string | null) => void;
  addSemester: (data: { name: string; startDate: string; endDate: string; isActive?: boolean }) => Promise<Semester>;
  editSemester: (id: string, data: Record<string, any>) => Promise<void>;
  removeSemester: (id: string) => Promise<void>;
}

export const createSemesterSlice: StateCreator<AppState, [], [], SemesterSlice> = (set, get) => ({
  semesters: [],
  activeSemesterId: null,
  isSemestersLoading: false,

  loadSemesters: async () => {
    set({ isSemestersLoading: true });
    try {
      const semesters = await fetchSemesters();
      const active = semesters.find((s) => s.isActive);
      set({
        semesters,
        activeSemesterId: active?.id || null,
        isSemestersLoading: false,
      });
    } catch {
      set({ isSemestersLoading: false });
    }
  },

  setActiveSemester: (id) => {
    set({ activeSemesterId: id });
  },

  addSemester: async (data) => {
    const semester = await apiCreateSemester(data);
    await get().loadSemesters();
    return semester;
  },

  editSemester: async (id, data) => {
    await apiUpdateSemester(id, data);
    await get().loadSemesters();
  },

  removeSemester: async (id) => {
    await apiDeleteSemester(id);
    set((s) => ({
      semesters: s.semesters.filter((sem) => sem.id !== id),
      activeSemesterId: s.activeSemesterId === id ? null : s.activeSemesterId,
    }));
  },
});
