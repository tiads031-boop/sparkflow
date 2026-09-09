/**
 * Course 数据 Slice
 *
 * 课程列表、当前选中课程、笔记等状态管理。
 * 依赖 api/courses.ts 的所有 API 函数。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Course, CourseDetail, CourseFormData } from '../types';
import {
  fetchCourses,
  fetchCourseDetail,
  createCourse as apiCreateCourse,
  updateCourse as apiUpdateCourse,
  deleteCourse as apiDeleteCourse,
  createCourseNote as apiCreateNote,
  updateCourseNote as apiUpdateNote,
  deleteCourseNote as apiDeleteNote,
} from '../api/courses';
import { DEFAULT_USER_ID } from '../api/client';

export interface CourseSlice {
  // ── 状态 ──
  courses: Course[];
  selectedCourse: CourseDetail | null;
  isCoursesLoading: boolean;
  coursesStatus: 'idle' | 'loading' | 'success' | 'error' | 'refreshing';
  coursesError: string | null;

  // ── 列表操作 ──
  loadCourses: () => Promise<void>;
  addCourse: (data: CourseFormData) => Promise<CourseDetail>;
  editCourse: (id: string, data: Partial<CourseFormData>) => Promise<void>;
  removeCourse: (id: string) => Promise<void>;

  // ── 详情操作 ──
  setSelectedCourse: (course: CourseDetail | null) => void;
  loadCourseDetail: (id: string) => Promise<void>;

  // ── 笔记操作 ──
  addNote: (courseId: string, body: string, pinned?: boolean) => Promise<void>;
  editNote: (noteId: string, data: { body?: string; pinned?: boolean }) => Promise<void>;
  removeNote: (noteId: string) => Promise<void>;
}

let activeCourseRequest: AbortController | null = null;
let courseRequestSequence = 0;

export const createCourseSlice: StateCreator<AppState, [], [], CourseSlice> = (set, get) => ({
  courses: [],
  selectedCourse: null,
  isCoursesLoading: false,
  coursesStatus: 'idle',
  coursesError: null,

  // ── 列表 ──

  loadCourses: async () => {
    activeCourseRequest?.abort();
    const controller = new AbortController();
    activeCourseRequest = controller;
    const requestSequence = ++courseRequestSequence;
    const semesterId = get().activeSemesterId;
    set({
      isCoursesLoading: true,
      coursesStatus: get().courses.length ? 'refreshing' : 'loading',
      coursesError: null,
    });
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    try {
      const courses = await fetchCourses(DEFAULT_USER_ID, semesterId, controller.signal);
      if (requestSequence === courseRequestSequence && get().activeSemesterId === semesterId) {
        set({ courses, isCoursesLoading: false, coursesStatus: 'success' });
      }
    } catch (err: unknown) {
      if (requestSequence !== courseRequestSequence) return;
      const message = err instanceof DOMException && err.name === 'AbortError'
        ? '加载课程超时，请检查网络后重试'
        : (err instanceof Error ? err.message : '加载课程失败');
      set({ coursesError: message, isCoursesLoading: false, coursesStatus: 'error' });
    } finally {
      clearTimeout(timeoutId);
      if (requestSequence === courseRequestSequence) activeCourseRequest = null;
    }
  },

  addCourse: async (data) => {
    const detail = await apiCreateCourse(data);
    await get().loadCourses();
    return detail;
  },

  editCourse: async (id, data) => {
    await apiUpdateCourse(id, data);
    await get().loadCourses();
    // 如果正在查看该课程详情，刷新
    if (get().selectedCourse?.id === id) {
      await get().loadCourseDetail(id);
    }
  },

  removeCourse: async (id) => {
    await apiDeleteCourse(id);
    set((s) => ({
      courses: s.courses.filter((c) => c.id !== id),
      selectedCourse: s.selectedCourse?.id === id ? null : s.selectedCourse,
    }));
  },

  // ── 详情 ──

  setSelectedCourse: (course) => set({ selectedCourse: course }),

  loadCourseDetail: async (id) => {
    try {
      const detail = await fetchCourseDetail(id);
      set({ selectedCourse: detail });
    } catch (err: unknown) {
      set({ coursesError: err instanceof Error ? err.message : '加载课程详情失败' });
    }
  },

  // ── 笔记 ──

  addNote: async (courseId, body, pinned = false) => {
    const note = await apiCreateNote(courseId, body, pinned);
    set((s) => {
      if (!s.selectedCourse) return s;
      return {
        selectedCourse: {
          ...s.selectedCourse,
          notes: [note, ...s.selectedCourse.notes],
        },
      };
    });
  },

  editNote: async (noteId, data) => {
    const updated = await apiUpdateNote(noteId, data);
    set((s) => {
      if (!s.selectedCourse) return s;
      return {
        selectedCourse: {
          ...s.selectedCourse,
          notes: s.selectedCourse.notes.map((n) => (n.id === noteId ? updated : n)),
        },
      };
    });
  },

  removeNote: async (noteId) => {
    await apiDeleteNote(noteId);
    set((s) => {
      if (!s.selectedCourse) return s;
      return {
        selectedCourse: {
          ...s.selectedCourse,
          notes: s.selectedCourse.notes.filter((n) => n.id !== noteId),
        },
      };
    });
  },
});
