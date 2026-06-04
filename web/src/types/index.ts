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

export type PresetTaskSection = 'project' | 'personal' | 'work' | 'study';
export type TaskSection = PresetTaskSection | (string & {});

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

  /** 看板分区：项目待办 / 个人待办 / 工作待办 / 学业待办，并兼容自定义分组 */
  section?: TaskSection;
  /** 文件夹 / 项目名称 */
  project?: string;
  /** V4 Calendar: 开始时间 "HH:MM" */
  startTime?: string;
  /** 任务安排到时间线的完整本地/ISO 日期时间 */
  scheduledStart?: string;
  /** 任务安排结束的完整 ISO 日期时间 */
  scheduledEnd?: string;
  /** V4 Calendar: 持续时长 (分钟) */
  duration?: number;
  /** 独立提醒时间，可早于/晚于截止时间 */
  reminderAt?: string;
  /** 重复规则：daily / weekly / monthly */
  repeatRule?: 'daily' | 'weekly' | 'monthly' | string;
  repeatStartDate?: string;
  repeatEndDate?: string;
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
  /** 对应数据库 CalendarEvent.startTime，API 序列化为 ISO 字符串 */
  startTime: string;
  /** 对应数据库 CalendarEvent.endTime，API 序列化为 ISO 字符串 */
  endTime: string;
  eventType?: string;
  courseId?: string;
  color?: string;
  isOverride?: boolean;
  extendedProps?: { taskId?: string; eventType?: string };
}

// ════════════════════════════════════════════════════
// Semester
// ════════════════════════════════════════════════════

export interface Semester {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  weeks?: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: { courses: number };
}

// ════════════════════════════════════════════════════
// Course & CourseNote
// ════════════════════════════════════════════════════

export interface Course {
  id: string;
  userId: string;
  semesterId?: string | null;
  name: string;
  teacher?: string;
  room?: string;
  color: string;
  dayOfWeek?: number;   // 1=Mon..7=Sun
  startTime?: string;    // "08:00"
  endTime?: string;      // "09:40"
  weeks?: number[];      // [1,2,3,...]
  location?: string;
  icsUid?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { events: number; tasks: number; notes: number };
}

export interface CourseDetail extends Course {
  events: CalendarEvent[];
  tasks: Task[];
  notes: CourseNote[];
}

export interface CourseNote {
  id: string;
  userId: string;
  courseId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseFormData {
  name: string;
  teacher?: string;
  room?: string;
  color?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  weeks?: number[];
  location?: string;
  semesterId?: string;
}

// ════════════════════════════════════════════════════
// UI State
// ════════════════════════════════════════════════════

export type ChartView = 'day' | 'week' | 'month';

export type ActiveTab =
  | 'dashboard'
  | 'tasks'
  | 'board'
  | 'calendar'
  | 'sparks'
  | 'courses'
  | 'settings';

export type ToggleableNavTab = Exclude<ActiveTab, 'settings'>;

export type NavVisibility = Record<ToggleableNavTab, boolean>;

export type NavOrder = ToggleableNavTab[];
