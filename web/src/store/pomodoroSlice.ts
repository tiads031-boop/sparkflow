/**
 * Pomodoro Slice
 *
 * 番茄钟状态机：开始 / 暂停 / 恢复 / 停止 / 完成。
 * 与服务端 pomodoro 表双向同步。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { PomodoroState } from '../types';
import { apiRequest, DEFAULT_USER_ID } from '../api/client';
import { DEFAULT_DURATION } from './constants';

export interface PomodoroSlice {
  pomodoro: PomodoroState;
  startPomodoro: (taskId?: string) => Promise<void>;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => Promise<void>;
  tick: () => void;
  completePomodoro: () => Promise<void>;
  loadPomodoroStats: () => Promise<void>;
}

const INITIAL_POMODORO: PomodoroState = {
  isRunning: false,
  isPaused: false,
  timeLeft: DEFAULT_DURATION,
  duration: DEFAULT_DURATION,
  activeTaskId: null,
  activeSessionId: null,
  todayCount: 0,
  totalFocusMinutes: 0,
};

export const createPomodoroSlice: StateCreator<AppState, [], [], PomodoroSlice> = (set, get) => ({
  pomodoro: { ...INITIAL_POMODORO },

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
          isRunning: true,
          isPaused: false,
          timeLeft: state.pomodoro.duration,
          activeTaskId: taskId ?? null,
          activeSessionId: session.id,
        },
      }));
    } catch {
      // API 失败时仍启动本地计时器
      set((state) => ({
        pomodoro: {
          ...state.pomodoro,
          isRunning: true,
          isPaused: false,
          timeLeft: state.pomodoro.duration,
          activeTaskId: taskId ?? null,
        },
      }));
    }
  },

  pausePomodoro: () =>
    set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: true } })),

  resumePomodoro: () =>
    set((state) => ({ pomodoro: { ...state.pomodoro, isPaused: false } })),

  stopPomodoro: async () => {
    const { activeSessionId } = get().pomodoro;
    if (activeSessionId) {
      try {
        await apiRequest(`/pomodoro/${activeSessionId}/interrupt`, { method: 'POST' });
      } catch {
        /* API 失败静默处理 */
      }
    }
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
        isPaused: false,
        timeLeft: state.pomodoro.duration,
        activeTaskId: null,
        activeSessionId: null,
      },
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
      } catch {
        /* API 失败静默处理 */
      }
    }
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
        isPaused: false,
        timeLeft: state.pomodoro.duration,
        activeTaskId: null,
        activeSessionId: null,
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
    } catch {
      /* API 失败静默处理 */
    }
  },
});
