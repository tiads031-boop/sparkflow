import { create } from 'zustand';

// --- Types ---
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
  column?: 'project' | 'personal';
}

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

export interface PomodoroState {
  isRunning: boolean;
  isPaused: boolean;
  timeLeft: number;
  duration: number;
  activeTaskId: string | null;
  todayCount: number;
  totalFocusMinutes: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  extendedProps?: { taskId?: string; eventType?: string };
}

export interface SyncConflict {
  id: string;
  field: string;
  mine: string;
  latest: string;
}

/** ContextBridge 协议层原始条目 */
export interface ContextEntry {
  hash: string;
  title: string;
  description: string;
  status: 'todo' | 'done';
  priority: 'high' | 'medium' | 'low';
  section: 'project' | 'personal';
  project: string;
  notes: string[];
  rawLine: string;
}

// --- API Utils ---
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;
const API_KEY = (import.meta.env.VITE_API_KEY || '') as string;

async function apiRequest(path: string, options?: RequestInit) {
  const url = API_BASE ? `${API_BASE}${path}` : path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options?.headers as Record<string, string>) || {}),
  };
  if (API_KEY) headers['X-API-Key'] = API_KEY;

  const res = await fetch(url, { ...options, headers });
  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res;
}

async function hashTitle(title: string): Promise<string> {
  const normalized = title.trim().toLowerCase().replace(/\s+/g, ' ');
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

// --- Mapping ---
function entriesToTasks(entries: ContextEntry[]): Task[] {
  return entries.map((e) => ({
    id: e.hash,
    title: e.title,
    description: e.description,
    status: e.status === 'done' ? 'Done' : 'To do',
    priority:
      e.priority === 'high' ? 'High Priority' :
      e.priority === 'medium' ? 'Medium' : 'Low',
    colorType:
      e.priority === 'high' ? 'dark' :
      e.priority === 'medium' ? 'green' : 'purple',
    column: e.section,
    contextMdHash: e.hash,
    comments: e.notes.length,
    subtasks: e.notes.map((n, i) => ({
      id: `${e.hash}-note-${i}`,
      title: n,
      completed: false,
    })),
    time: e.description || undefined,
  }));
}

function tasksToEntries(tasks: Task[]): ContextEntry[] {
  return tasks.map((t) => ({
    hash: t.contextMdHash || t.id,
    title: t.title,
    description: t.description || '',
    status: t.status === 'Done' ? 'done' : 'todo',
    priority:
      t.priority === 'High Priority' ? 'high' :
      t.priority === 'Medium' ? 'medium' : 'low',
    section: t.column || 'personal',
    project: '',
    notes: t.subtasks?.map((s) => s.title) || [],
    rawLine: '',
  }));
}

// --- Initial Data (fallback when API unavailable) ---
const initialTasks: Task[] = [
  {
    id: '1', title: 'Web 应用程序用户注册流程',
    time: '10:00 AM - 05:30 PM', status: 'In review', priority: 'High Priority',
    colorType: 'dark', comments: 6, column: 'project',
    subtasks: [
      { id: '101', title: '完成验证码模块接入', completed: true },
      { id: '102', title: '优化密码错误提示 UI', completed: false },
    ],
  },
  {
    id: '2', title: '管理后台用户流程梳理',
    time: '02:00 PM - 04:00 PM', status: 'In progress', priority: 'Medium',
    colorType: 'green', comments: 8, column: 'project',
    subtasks: [{ id: '201', title: '绘制核心流程图', completed: false }],
  },
  {
    id: '3', title: '管理面板仪表盘设计',
    time: 'Tomorrow', status: 'To do', priority: 'High Priority',
    colorType: 'purple', comments: 1, column: 'personal',
    subtasks: [],
  },
];

const initialSparks: Spark[] = [
  { id: 's1', text: '尝试用 Framer Motion 给卡片添加微交互动画，提升手感。', color: 'bg-[#cae393]', size: 160, pos: { x: 20, y: 10 }, rot: -2, z: 1 },
  { id: 's2', text: '竞品分析：Notion 的 database 视图很强大，但对于轻量级可能过于复杂。需要保持克制。', color: 'bg-[#b0a8db]', size: 180, pos: { x: 170, y: 30 }, rot: 3, z: 2 },
  { id: 's3', text: '色彩心理学：紫色代表创造力，绿色代表成长，深灰色代表专注。这个调色板选得很棒。', color: 'bg-white', size: 165, pos: { x: 40, y: 160 }, rot: -1.5, z: 3 },
  { id: 's4', text: '磨砂玻璃 + 散落卡片，让信息呼吸。留白即设计本身。', color: 'bg-[#f4f4f4]', size: 170, pos: { x: 180, y: 200 }, rot: 2.5, z: 4 },
];

const taskColors = ['dark', 'green', 'purple'] as const;
const sparkColors = ['bg-[#cae393]', 'bg-[#b0a8db]', 'bg-white', 'bg-[#f4f4f4]'];
const DEFAULT_DURATION = 25 * 60;

// --- Store ---
interface AppState {
  activeTab: 'dashboard' | 'tasks' | 'board' | 'calendar' | 'sparks';
  setActiveTab: (tab: AppState['activeTab']) => void;

  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;

  sparks: Spark[];
  setSparks: (sparks: Spark[]) => void;
  addSpark: (spark: Spark) => void;
  deleteSpark: (id: string) => void;
  updateSpark: (id: string, updates: Partial<Spark>) => void;

  pomodoro: PomodoroState;
  startPomodoro: (taskId?: string) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  tick: () => void;
  completePomodoro: () => void;

  events: CalendarEvent[];
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;

  conflicts: SyncConflict[];
  setConflicts: (conflicts: SyncConflict[]) => void;
  lastKnownMtime: number | null;
  setLastKnownMtime: (mtime: number | null) => void;

  // API 状态
  isLoading: boolean;
  syncError: string | null;
  isSyncing: boolean;
  hasLoaded: boolean;
  loadFromApi: () => Promise<void>;
  syncToApi: () => Promise<void>;
  clearSyncError: () => void;
  applyMergedEntries: (entries: ContextEntry[], mtime: number) => void;

  // 协议层原始数据
  entries: ContextEntry[];
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  tasks: initialTasks,
  setTasks: (tasks) => set({ tasks }),

  addTask: async (task) => {
    const hash = await hashTitle(task.title);
    const enriched = { ...task, id: hash, contextMdHash: hash };
    set((state) => ({ tasks: [enriched, ...state.tasks] }));
    await get().syncToApi();
  },

  updateTask: async (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    await get().syncToApi();
  },

  deleteTask: async (id) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    await get().syncToApi();
  },

  toggleSubtask: async (taskId, subtaskId) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, completed: !s.completed } : s
              ),
            }
          : t
      ),
    }));
    await get().syncToApi();
  },

  sparks: initialSparks,
  setSparks: (sparks) => set({ sparks }),
  addSpark: (spark) => set((state) => ({ sparks: [spark, ...state.sparks] })),
  deleteSpark: (id) => set((state) => ({ sparks: state.sparks.filter((s) => s.id !== id) })),
  updateSpark: (id, updates) =>
    set((state) => ({
      sparks: state.sparks.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  pomodoro: {
    isRunning: false, isPaused: false,
    timeLeft: DEFAULT_DURATION, duration: DEFAULT_DURATION,
    activeTaskId: null, todayCount: 0, totalFocusMinutes: 0,
  },
  startPomodoro: (taskId) =>
    set((state) => ({
      pomodoro: { ...state.pomodoro, isRunning: true, isPaused: false, timeLeft: state.pomodoro.duration, activeTaskId: taskId ?? null },
    })),
  pausePomodoro: () => set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: true } })),
  resumePomodoro: () => set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: false } })),
  stopPomodoro: () =>
    set((state) => ({
      pomodoro: { ...state.pomodoro, isRunning: false, isPaused: false, timeLeft: state.pomodoro.duration, activeTaskId: null },
    })),
  tick: () =>
    set((state) => {
      if (!state.pomodoro.isRunning || state.pomodoro.isPaused) return state;
      const newTime = state.pomodoro.timeLeft - 1;
      if (newTime <= 0) return { pomodoro: { ...state.pomodoro, timeLeft: 0, isRunning: false } };
      return { pomodoro: { ...state.pomodoro, timeLeft: newTime } };
    }),
  completePomodoro: () =>
    set((state) => ({
      pomodoro: {
        ...state.pomodoro, todayCount: state.pomodoro.todayCount + 1,
        totalFocusMinutes: state.pomodoro.totalFocusMinutes + 25,
        isRunning: false, isPaused: false, timeLeft: state.pomodoro.duration, activeTaskId: null,
      },
    })),

  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  deleteEvent: (id) => set((state) => ({ events: state.events.filter((e) => e.id !== id) })),

  conflicts: [],
  setConflicts: (conflicts) => set({ conflicts }),
  lastKnownMtime: null,
  setLastKnownMtime: (mtime) => set({ lastKnownMtime: mtime }),

  isLoading: false,
  syncError: null,
  isSyncing: false,
  hasLoaded: false,
  clearSyncError: () => set({ syncError: null }),

  entries: [],

  applyMergedEntries: (entries, mtime) => {
    const tasks = entriesToTasks(entries);
    set({ entries, tasks, lastKnownMtime: mtime, conflicts: [] });
  },

  loadFromApi: async () => {
    set({ isLoading: true, syncError: null });
    try {
      const res = await apiRequest('/context');
      const data = await res.json();
      const entries: ContextEntry[] = data.entries || [];
      const mtime: number = data.mtime || 0;
      const tasks = entriesToTasks(entries);
      set({ entries, tasks, lastKnownMtime: mtime, isLoading: false, hasLoaded: true });
    } catch (err: any) {
      set({ syncError: err.message || '加载失败', isLoading: false, hasLoaded: true });
    }
  },

  syncToApi: async () => {
    const { tasks, lastKnownMtime, isSyncing } = get();
    if (isSyncing) return;
    set({ isSyncing: true, syncError: null });
    try {
      const entries = tasksToEntries(tasks);
      const res = await apiRequest('/context/write', {
        method: 'POST',
        body: JSON.stringify({ entries, lastKnownMtime }),
      });
      if (res.status === 409) {
        const data = await res.json();
        set({
          conflicts: (data.conflicts || []).map((c: any) => ({
            id: c.hash,
            field: c.fields?.join(', ') || '',
            mine: JSON.stringify(c.userVersion),
            latest: JSON.stringify(c.serverVersion),
          })),
          lastKnownMtime: data.serverMtime || lastKnownMtime,
          isSyncing: false,
        });
        return;
      }
      const data = await res.json();
      const newEntries: ContextEntry[] = data.entries || [];
      const newTasks = entriesToTasks(newEntries);
      set({
        entries: newEntries,
        tasks: newTasks,
        lastKnownMtime: data.mtime || lastKnownMtime,
        conflicts: [],
        isSyncing: false,
      });
    } catch (err: any) {
      set({ syncError: err.message || '同步失败', isSyncing: false });
    }
  },
}));

export { taskColors, sparkColors };
