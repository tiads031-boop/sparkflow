/**
 * SparkFlow Store — 向后兼容重导出
 *
 * ⚠️ 此文件已迁移至 Zustand slice 架构。
 * 实现位于 store/index.ts（组合入口）和各 store/*Slice.ts 文件中。
 *
 * 保留此文件仅为外部兼容：所有 `import ... from './store/appStore'` 仍能正常工作。
 * 新代码请直接从 store/index.ts 或 types/index.ts 导入。
 */
export { useAppStore } from './index';
export { taskColors, sparkColors } from './constants';

// 类型重导出（保持 import type 兼容）
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
} from '../types';
