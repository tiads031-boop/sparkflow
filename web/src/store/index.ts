/**
 * SparkFlow 全局 Store
 *
 * Zustand slice 组合模式。
 * 按 domain 拆分为 7 个 slice，通过 get() 实现跨 slice 调用。
 */

import { create } from 'zustand';

// ── Slice creators ──
import { createTaskSlice, type TaskSlice } from './taskSlice';
import { createPomodoroSlice, type PomodoroSlice } from './pomodoroSlice';
import { createPushSlice, type PushSlice } from './pushSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { createDataSlice, type DataSlice } from './dataSlice';
import { createCourseSlice, type CourseSlice } from './courseSlice';
import { createSemesterSlice, type SemesterSlice } from './semesterSlice';
import { createGoogleSyncSlice, type GoogleSyncSlice } from './googleSyncSlice';
import { createAuthSlice, type AuthSlice } from './authSlice';

// ── AppState = 所有 slice 的并集 ──
export type AppState = TaskSlice &
  PomodoroSlice &
  PushSlice &
  UISlice &
  DataSlice &
  CourseSlice &
  SemesterSlice &
  GoogleSyncSlice &
  AuthSlice;

// ── 组合 store ──
export const useAppStore = create<AppState>()((...args) => ({
  ...createTaskSlice(...args),
  ...createPomodoroSlice(...args),
  ...createPushSlice(...args),
  ...createUISlice(...args),
  ...createDataSlice(...args),
  ...createCourseSlice(...args),
  ...createSemesterSlice(...args),
  ...createGoogleSyncSlice(...args),
  ...createAuthSlice(...args),
}));

// ── Re-export constants (保持外部兼容) ──
export { taskColors, sparkColors, initialSparks, DEFAULT_DURATION } from './constants';

// ── Re-export types (原 appStore.ts 的所有类型导出) ──
export type {
  Task,
  Subtask,
  Spark,
  PomodoroState,
  CalendarEvent,
  ChartView,
  ActiveTab,
} from '../types';

export type {
  AuthSlice,
  SparkFlowProfession,
  SparkFlowProfile,
  SparkFlowStatusNeed,
} from './authSlice';
