/**
 * SparkFlow 全局 Store
 *
 * Zustand slice 组合模式。
 * 按 domain 拆分为 6 个 slice，通过 get() 实现跨 slice 调用。
 *
 * Slice 依赖：
 *   taskSlice → syncSlice.syncToApi()
 *   pomodoroSlice → api/client.ts（无 slice 依赖）
 *   pushSlice → api/client.ts（无 slice 依赖）
 *   syncSlice → taskSlice.tasks, api/client.ts
 *   uiSlice → 无依赖
 *   dataSlice → 无依赖
 *
 * 外部 API 签名完全不变，所有已有 import 无需修改。
 */

import { create } from 'zustand';

// ── Slice creators ──
import { createTaskSlice, type TaskSlice } from './taskSlice';
import { createPomodoroSlice, type PomodoroSlice } from './pomodoroSlice';
import { createPushSlice, type PushSlice } from './pushSlice';
import { createSyncSlice, type SyncSlice } from './syncSlice';
import { createUISlice, type UISlice } from './uiSlice';
import { createDataSlice, type DataSlice } from './dataSlice';

// ── AppState = 所有 slice 的并集 ──
export type AppState = TaskSlice & PomodoroSlice & PushSlice & SyncSlice & UISlice & DataSlice;

// ── 组合 store ──
export const useAppStore = create<AppState>()((...args) => ({
  ...createTaskSlice(...args),
  ...createPomodoroSlice(...args),
  ...createPushSlice(...args),
  ...createSyncSlice(...args),
  ...createUISlice(...args),
  ...createDataSlice(...args),
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
  SyncConflict,
  NoteItem,
  ContextEntry,
  ChartView,
  ActiveTab,
} from '../types';
