/**
 * SparkFlow 共享类型定义
 *
 * 所有 domain 共享的接口和类型别名集中定义在此。
 * 各 store slice、组件、api 模块均从此处导入。
 */

// ════════════════════════════════════════════════════
// Task & Subtask
// ════════════════════════════════════════════════════

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  status: 'To do' | 'In progress' | 'In review' | 'Done' | 'Cancelled';
  priority: 'High Priority' | 'Medium' | 'Low';
  colorType: 'dark' | 'green' | 'purple';
  time?: string;
  comments: number;
  subtasks: Subtask[];
  description?: string;
  dueDate?: string;
  estimatedMinutes?: number;
  contextMdHash?: string;
  /** 看板分区：项目待办 / 个人待办 */
  section?: 'project' | 'personal';
  /** 文件夹 / 项目名称 */
  project?: string;
  /** V4 Calendar: 开始时间 "HH:MM" */
  startTime?: string;
  /** V4 Calendar: 持续时长 (分钟) */
  duration?: number;
}

// ════════════════════════════════════════════════════
// Spark (灵感卡片)
// ════════════════════════════════════════════════════

export interface Spark {
  id: string;
  text: string;
  color: string;
  size: number;
  pos: { x: number; y: number };
  rot: number;
  z: number;
  tag?: string;
  source?: string;
  createdAt?: string;
}

// ════════════════════════════════════════════════════
// Pomodoro
// ════════════════════════════════════════════════════

export interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  timeLeft: number;
  duration: number;
  activeTaskId: string | null;
  activeSessionId: string | null;
  todayCount: number;
  totalFocusMinutes: number;
}

// ════════════════════════════════════════════════════
// Calendar
// ════════════════════════════════════════════════════

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  extendedProps?: { taskId?: string; eventType?: string };
}

// ════════════════════════════════════════════════════
// Sync & ContextBridge
// ════════════════════════════════════════════════════

export interface SyncConflict {
  id: string;
  field: string;
  mine: string;
  latest: string;
}

/** 协议层备注 / 子任务项 */
export interface NoteItem {
  text: string;
  completed: boolean;
}

/** ContextBridge 协议层原始条目 */
export interface ContextEntry {
  hash: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'in-review' | 'done' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  section: 'project' | 'personal';
  project: string;
  notes: NoteItem[];
  rawLine: string;
  dueDate?: string;
}

// ════════════════════════════════════════════════════
// UI State
// ════════════════════════════════════════════════════

export type ChartView = 'day' | 'week' | 'month';

export type ActiveTab = 'dashboard' | 'tasks' | 'board' | 'calendar' | 'sparks';
