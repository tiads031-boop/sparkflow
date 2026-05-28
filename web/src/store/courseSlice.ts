/**
 * Course 数据 Slice
 *
 * 课程列表、当前选中课程、笔记等状态管理。
 * 依赖 api/courses.ts 的所有 API 函数。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Course, CourseDetail, CourseNote, CourseFormData } from '../types';
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

export interface CourseSlice {
  // ── 状态 ──
  courses: Course[];
  selectedCourse: CourseDetail | null;
  isCoursesLoading: boolean;
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

export const createCourseSlice: StateCreator<AppState, [], [], CourseSlice> = (set, get) => ({
  courses: [],
  selectedCourse: null,
  isCoursesLoading: false,
  coursesError: null,

  // ── 列表 ──

  loadCourses: async () => {
    set({ isCoursesLoading: true, coursesError: null });
    try {
      const courses = await fetchCourses();
      set({ courses, isCoursesLoading: false });
    } catch (err: any) {
      set({ coursesError: err.message || '加载课程失败', isCoursesLoading: false });
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
    } catch (err: any) {
      set({ coursesError: err.message || '加载课程详情失败' });
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
