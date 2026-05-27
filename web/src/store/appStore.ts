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
  project?: string;
  /** V4 Calendar: 开始时间 "HH:MM" */
  startTime?: string;
  /** V4 Calendar: 持续时长 (分钟) */
  duration?: number;
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
  activeSessionId: string | null;
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

// --- API Utils ---
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '') as string;
const API_KEY = (import.meta.env.VITE_API_KEY || '') as string;
const DEFAULT_USER_ID = (import.meta.env.VITE_DEFAULT_USER_ID || 'default') as string;

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
  const statusMap: Record<string, Task['status']> = {
    'todo': 'To do',
    'in-progress': 'In progress',
    'in-review': 'In review',
    'done': 'Done',
    'cancelled': 'Cancelled',
  };

  return entries.map((e) => ({
    id: e.hash,
    title: e.title,
    description: e.description,
    status: statusMap[e.status] || 'To do',
    priority:
      e.priority === 'high' ? 'High Priority' :
      e.priority === 'medium' ? 'Medium' : 'Low',
    colorType:
      e.priority === 'high' ? 'dark' :
      e.priority === 'medium' ? 'green' : 'purple',
    column: e.section,
    contextMdHash: e.hash,
    project: e.project,
    comments: e.notes.length,
    subtasks: e.notes.map((n, i) => ({
      id: `${e.hash}-note-${i}`,
      title: n.text,
      completed: n.completed,
    })),
    time: e.description || undefined,
    dueDate: e.dueDate,
  }));
}

function tasksToEntries(tasks: Task[]): ContextEntry[] {
  const statusMap: Record<Task['status'], ContextEntry['status']> = {
    'To do': 'todo',
    'In progress': 'in-progress',
    'In review': 'in-review',
    'Done': 'done',
    'Cancelled': 'cancelled',
  };

  return tasks.map((t) => ({
    hash: t.contextMdHash || t.id,
    title: t.title,
    description: t.description || '',
    status: statusMap[t.status] || 'todo',
    priority:
      t.priority === 'High Priority' ? 'high' :
      t.priority === 'Medium' ? 'medium' : 'low',
    section: t.column || 'personal',
    project: t.project || '',
    notes: t.subtasks?.map((s) => ({ text: s.title, completed: s.completed })) || [],
    rawLine: '',
    dueDate: t.dueDate,
  }));
}

// --- Initial Data (fallback when API unavailable) ---
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
export type ChartView = 'day' | 'week' | 'month';

interface AppState {
  activeTab: 'dashboard' | 'tasks' | 'board' | 'calendar' | 'sparks';
  setActiveTab: (tab: AppState['activeTab']) => void;

  /** V4 Dashboard: 图表视图模式 */
  chartView: ChartView;
  setChartView: (view: ChartView) => void;

  /** V4 Calendar: 选中日期 */
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;

  /** V4 Calendar: 日历头展开状态 */
  calendarHeaderExpanded: boolean;
  setCalendarHeaderExpanded: (expanded: boolean) => void;

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
  startPomodoro: (taskId?: string) => Promise<void>;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => Promise<void>;
  tick: () => void;
  completePomodoro: () => Promise<void>;
  loadPomodoroStats: () => Promise<void>;

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

  // 轮询检测外部 md 变更
  pollForUpdates: () => Promise<void>;

  // 协议层原始数据
  entries: ContextEntry[];

  // Push 通知
  pushEnabled: boolean;
  pushSupported: boolean;
  subscribeToPush: () => Promise<void>;
  unsubscribeFromPush: () => Promise<void>;
  checkPushStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'tasks',
  setActiveTab: (tab) => set({ activeTab: tab }),

  chartView: 'month' as ChartView,
  setChartView: (view) => set({ chartView: view }),

  selectedDate: new Date(),
  setSelectedDate: (date) => set({ selectedDate: date }),

  calendarHeaderExpanded: false,
  setCalendarHeaderExpanded: (expanded) => set({ calendarHeaderExpanded: expanded }),

  tasks: [],
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
    activeTaskId: null, activeSessionId: null,
    todayCount: 0, totalFocusMinutes: 0,
  },
  startPomodoro: async (taskId) => {
    try {
      const res = await apiRequest('/pomodoro', {
        method: 'POST',
        body: JSON.stringify({ userId: DEFAULT_USER_ID, taskId, duration: 25 }),
      });
      const session = await res.json();
      set((state) => ({
        pomodoro: {
          ...state.pomodoro,
          isRunning: true, isPaused: false,
          timeLeft: state.pomodoro.duration,
          activeTaskId: taskId ?? null,
          activeSessionId: session.id,
        },
      }));
    } catch {
      set((state) => ({
        pomodoro: { ...state.pomodoro, isRunning: true, isPaused: false, timeLeft: state.pomodoro.duration, activeTaskId: taskId ?? null },
      }));
    }
  },
  pausePomodoro: () => set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: true } })),
  resumePomodoro: () => set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: false } })),
  stopPomodoro: async () => {
    const { activeSessionId } = get().pomodoro;
    if (activeSessionId) {
      try {
        await apiRequest(`/pomodoro/${activeSessionId}/interrupt`, { method: 'POST' });
      } catch { /* ignore */ }
    }
    set((state) => ({
      pomodoro: { ...state.pomodoro, isRunning: false, isPaused: false, timeLeft: state.pomodoro.duration, activeTaskId: null, activeSessionId: null },
    }));
  },
  tick: () =>
    set((state) => {
      if (!state.pomodoro.isRunning || state.pomodoro.isPaused) return state;
      const newTime = state.pomodoro.timeLeft - 1;
      if (newTime <= 0) {
        get().completePomodoro();
        return state;
      }
      return { pomodoro: { ...state.pomodoro, timeLeft: newTime } };
    }),
  completePomodoro: async () => {
    const { activeSessionId } = get().pomodoro;
    if (activeSessionId) {
      try {
        await apiRequest(`/pomodoro/${activeSessionId}/complete`, { method: 'POST' });
      } catch { /* ignore */ }
    }
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false, isPaused: false,
        timeLeft: state.pomodoro.duration,
        activeTaskId: null, activeSessionId: null,
      },
    }));
    await get().loadPomodoroStats();
  },
  loadPomodoroStats: async () => {
    try {
      const res = await apiRequest(`/pomodoro/stats?userId=${DEFAULT_USER_ID}`);
      const stats = await res.json();
      set((state) => ({
        pomodoro: {
          ...state.pomodoro,
          todayCount: stats.todayCount ?? 0,
          totalFocusMinutes: stats.totalMinutes ?? 0,
        },
      }));
    } catch { /* ignore */ }
  },

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

  pollForUpdates: async () => {
    const { lastKnownMtime, isSyncing } = get();
    // 正在同步时不轮询，避免竞态
    if (isSyncing) return;
    try {
      const res = await apiRequest('/context');
      const data = await res.json();
      const serverMtime: number = data.mtime || 0;
      // mtime 未变化，跳过
      if (lastKnownMtime && serverMtime === lastKnownMtime) return;

      const entries: ContextEntry[] = data.entries || [];
      const tasks = entriesToTasks(entries);
      set({ entries, tasks, lastKnownMtime: serverMtime, syncError: null });

      // 更新本地缓存
      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(tasks));
        localStorage.setItem('sparkflow_mtime_cache', String(serverMtime));
      } catch { /* 缓存写入失败静默处理 */ }
    } catch {
      // 轮询失败静默处理，不打断用户
    }
  },

  loadFromApi: async () => {
    set({ isLoading: true, syncError: null });

    // 1. 先尝试从 localStorage 恢复缓存，实现 immediate render
    try {
      const cached = localStorage.getItem('sparkflow_tasks_cache');
      const cachedMtime = localStorage.getItem('sparkflow_mtime_cache');
      if (cached) {
        const parsed = JSON.parse(cached) as Task[];
        const mtime = cachedMtime ? Number(cachedMtime) : null;
        set({ tasks: parsed, hasLoaded: true, lastKnownMtime: mtime });
      }
    } catch { /* 缓存读取失败静默处理 */ }

    try {
      const res = await apiRequest('/context');
      const data = await res.json();
      const entries: ContextEntry[] = data.entries || [];
      const mtime: number = data.mtime || 0;
      const tasks = entriesToTasks(entries);
      set({ entries, tasks, lastKnownMtime: mtime, isLoading: false, hasLoaded: true, syncError: null });

      // 同步成功后写入本地缓存
      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(tasks));
        localStorage.setItem('sparkflow_mtime_cache', String(mtime));
      } catch { /* 缓存写入失败静默处理 */ }
    } catch (err: any) {
      // API 失败时保留现有 tasks（可能是缓存恢复的），不清空
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
      const newMtime = data.mtime || lastKnownMtime;
      set({
        entries: newEntries,
        tasks: newTasks,
        lastKnownMtime: newMtime,
        conflicts: [],
        isSyncing: false,
      });

      // 同步成功后更新本地缓存
      try {
        localStorage.setItem('sparkflow_tasks_cache', JSON.stringify(newTasks));
        localStorage.setItem('sparkflow_mtime_cache', String(newMtime));
      } catch { /* 缓存写入失败静默处理 */ }
    } catch (err: any) {
      set({ syncError: err.message || '同步失败', isSyncing: false });
    }
  },

  // === Push 通知 ===
  pushEnabled: false,
  pushSupported: 'serviceWorker' in navigator && 'PushManager' in window,

  checkPushStatus: async () => {
    if (!('serviceWorker' in navigator)) {
      set({ pushSupported: false, pushEnabled: false });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      set({ pushEnabled: !!sub, pushSupported: true });
    } catch {
      set({ pushSupported: false, pushEnabled: false });
    }
  },

  subscribeToPush: async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] permission denied');
        return;
      }

      // 获取 VAPID 公钥
      const keyRes = await apiRequest('/push/vapid-public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        console.error('[Push] VAPID public key not available');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const subJson = subscription.toJSON();
      await apiRequest('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          userId: DEFAULT_USER_ID,
          subscription: {
            endpoint: subJson.endpoint,
            keys: {
              p256dh: subJson.keys!.p256dh,
              auth: subJson.keys!.auth,
            },
          },
        }),
      });

      set({ pushEnabled: true });
    } catch (err: any) {
      console.error('[Push] subscribe failed:', err.message);
      set({ pushEnabled: false });
    }
  },

  unsubscribeFromPush: async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await apiRequest('/push/unsubscribe', {
          method: 'DELETE',
          body: JSON.stringify({ userId: DEFAULT_USER_ID, endpoint: sub.endpoint }),
        });
      }
      set({ pushEnabled: false });
    } catch (err: any) {
      console.error('[Push] unsubscribe failed:', err.message);
    }
  },
}));

/** 将 Base64 URL-safe VAPID 公钥转为 Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray as Uint8Array<ArrayBuffer>;
}

export { taskColors, sparkColors };
