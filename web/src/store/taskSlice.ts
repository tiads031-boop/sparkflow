/**
 * Task CRUD Slice
 *
 * 任务增删改查 + 子任务 toggle。
 * 依赖 syncSlice.syncToApi() 进行持久化同步。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Task } from '../types';
import { hashTitle } from '../api/client';

export interface TaskSlice {
  tasks: Task[];
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
}

export const createTaskSlice: StateCreator<AppState, [], [], TaskSlice> = (set, get) => ({
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
    const prevTasks = get().tasks;
    const deletedTask = prevTasks.find((t) => t.id === id);

    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    try {
      await get().syncToApi();
    } catch {
      if (deletedTask) {
        set({ tasks: prevTasks });
      }
      throw new Error('删除同步失败，已恢复');
    }
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
});
