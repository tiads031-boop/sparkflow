/**
 * Task CRUD Slice
 *
 * 任务增删改查 + 子任务 toggle。
 * 纯 REST CRUD：直接通过 apiRequest 调用后端 /api/tasks 端点。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Task, Subtask } from '../types';
import { apiRequest, DEFAULT_USER_ID } from '../api/client';

// ════════════════════════════════════════════════════
// DB ↔ 前端 格式转换
// ════════════════════════════════════════════════════

interface ApiTask {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  section?: string | null;
  project?: string | null;
  notes?: { text: string; completed: boolean }[] | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  scheduledStart?: string | null;
  tags?: string[];
}

const STATUS_DB_TO_FRONT: Record<string, Task['status']> = {
  todo: 'To do',
  'in-progress': 'In progress',
  'in-review': 'In review',
  done: 'Done',
  cancelled: 'Cancelled',
};

const STATUS_FRONT_TO_DB: Record<string, string> = {
  'To do': 'todo',
  'In progress': 'in-progress',
  'In review': 'in-review',
  Done: 'done',
  Cancelled: 'cancelled',
};

const PRIORITY_DB_TO_FRONT: Record<string, Task['priority']> = {
  high: 'High Priority',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_FRONT_TO_DB: Record<string, string> = {
  'High Priority': 'high',
  Medium: 'medium',
  Low: 'low',
};

const PRIORITY_TO_COLOR: Record<string, Task['colorType']> = {
  high: 'dark',
  medium: 'green',
  low: 'purple',
};

function fromApiTask(api: ApiTask): Task {
  const subtasks: Subtask[] = (api.notes || []).map((n, i) => ({
    id: `${api.id}-note-${i}`,
    title: n.text,
    completed: n.completed,
  }));

  // Extract HH:MM from scheduledStart ISO string for CalendarView compatibility
  let startTime: string | undefined;
  let duration: number | undefined;
  if (api.scheduledStart) {
    const d = new Date(api.scheduledStart);
    startTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (api.estimatedMinutes) {
    duration = api.estimatedMinutes;
  }

  return {
    id: api.id,
    title: api.title,
    description: api.description || undefined,
    status: STATUS_DB_TO_FRONT[api.status] || 'To do',
    priority: PRIORITY_DB_TO_FRONT[api.priority] || 'Medium',
    colorType: PRIORITY_TO_COLOR[api.priority] || 'green',
    section: (api.section as Task['section']) || undefined,
    project: api.project || undefined,
    comments: subtasks.length,
    subtasks,
    dueDate: api.dueDate || undefined,
    estimatedMinutes: api.estimatedMinutes || undefined,
    startTime,
    duration,
  };
}

function toApiPayload(task: Partial<Task> & { title?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (task.title !== undefined) payload.title = task.title;
  if (task.description !== undefined) payload.description = task.description || '';
  if (task.status !== undefined) payload.status = STATUS_FRONT_TO_DB[task.status] || 'todo';
  if (task.priority !== undefined) payload.priority = PRIORITY_FRONT_TO_DB[task.priority] || 'medium';
  if (task.section !== undefined) payload.section = task.section;
  if (task.project !== undefined) payload.project = task.project;
  if (task.dueDate !== undefined) payload.dueDate = task.dueDate;
  if (task.estimatedMinutes !== undefined) payload.estimatedMinutes = task.estimatedMinutes;
  else if ((task as any).duration !== undefined) payload.estimatedMinutes = (task as any).duration;
  if (task.startTime !== undefined) {
    // Convert HH:MM to ISO datetime, using dueDate's date or today
    const datePart = task.dueDate ? new Date(task.dueDate) : new Date();
    const [h, m] = task.startTime.split(':').map(Number);
    datePart.setHours(h || 0, m || 0, 0, 0);
    payload.scheduledStart = datePart.toISOString();
  }
  if (task.subtasks !== undefined) {
    payload.notes = task.subtasks.map((s) => ({ text: s.title, completed: s.completed }));
  }

  return payload;
}

// ════════════════════════════════════════════════════
// Slice
// ════════════════════════════════════════════════════

export interface TaskSlice {
  tasks: Task[];
  isTaskLoading: boolean;
  taskError: string | null;

  setTasks: (tasks: Task[]) => void;
  loadTasks: () => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
}

export const createTaskSlice: StateCreator<AppState, [], [], TaskSlice> = (set, get) => ({
  tasks: [],
  isTaskLoading: false,
  taskError: null,

  setTasks: (tasks) => set({ tasks }),

  // ── 初始加载 ──
  loadTasks: async () => {
    set({ isTaskLoading: true, taskError: null });
    try {
      const res = await apiRequest(`/tasks?userId=${encodeURIComponent(DEFAULT_USER_ID)}`);
      const data: ApiTask[] = await res.json();
      const tasks = data.map(fromApiTask);
      set({ tasks, isTaskLoading: false });
    } catch (err: any) {
      set({ taskError: err.message || '加载任务失败', isTaskLoading: false });
    }
  },

  // ── 创建 ──
  addTask: async (task) => {
    const payload = {
      ...toApiPayload(task),
      userId: DEFAULT_USER_ID,
    };

    try {
      const res = await apiRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const created: ApiTask = await res.json();
      const frontTask = fromApiTask(created);
      set((state) => ({ tasks: [frontTask, ...state.tasks], taskError: null }));
    } catch (err: any) {
      const message = err.message || '添加任务失败';
      set({ taskError: message });
      throw new Error(message);
    }
  },

  // ── 更新 ──
  updateTask: async (id, updates) => {
    const payload = toApiPayload(updates);

    const res = await apiRequest(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });

    const updated: ApiTask = await res.json();
    const frontTask = fromApiTask(updated);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? frontTask : t)),
    }));
  },

  // ── 删除 ──
  deleteTask: async (id) => {
    const prevTasks = get().tasks;
    const deletedTask = prevTasks.find((t) => t.id === id);

    // 乐观删除
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));

    try {
      await apiRequest(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (err: any) {
      // 回滚
      if (deletedTask) {
        set({ tasks: prevTasks });
      }
      set({ taskError: err.message || '删除失败' });
    }
  },

  // ── 子任务 toggle ──
  toggleSubtask: async (taskId, subtaskId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    );

    // 乐观更新
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, subtasks: newSubtasks, comments: newSubtasks.length } : t,
      ),
    }));

    try {
      const payload = { notes: newSubtasks.map((s) => ({ text: s.title, completed: s.completed })) };
      const res = await apiRequest(`/tasks/${encodeURIComponent(taskId)}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const updated: ApiTask = await res.json();
      const frontTask = fromApiTask(updated);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === taskId ? frontTask : t)),
      }));
    } catch (err: any) {
      // 回滚
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === taskId ? task : t,
        ),
      }));
      set({ taskError: err.message || '更新子任务失败' });
    }
  },
});
