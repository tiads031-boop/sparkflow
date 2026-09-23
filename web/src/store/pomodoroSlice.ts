import type { StateCreator } from "zustand";
import type { AppState } from "./index";
import type { PomodoroState } from "../types";
import { apiRequest } from "../api/client";
import { DEFAULT_DURATION } from "./constants";

interface FocusSessionResponse {
  id: string;
  taskId: string | null;
  title?: string | null;
  notes?: string | null;
  status: "active" | "paused" | "completed" | "interrupted";
  revision: number;
  startedAt: string;
  endedAt: string | null;
  focusMode: "countdown" | "countup";
  plannedDurationSeconds: number;
  effectiveDurationSeconds: number;
  pausedDurationSeconds: number;
  remainingSeconds: number;
}

export interface PomodoroSlice {
  pomodoro: PomodoroState;
  startPomodoro: (
    taskId?: string,
    durationMinutes?: number,
    focusMode?: "countdown" | "countup",
    title?: string,
    notes?: string,
  ) => Promise<void>;
  loadActivePomodoro: () => Promise<void>;
  pausePomodoro: () => Promise<void>;
  resumePomodoro: () => Promise<void>;
  stopPomodoro: () => Promise<void>;
  tick: () => void;
  completePomodoro: () => Promise<void>;
  loadPomodoroStats: () => Promise<void>;
}

const INITIAL_POMODORO: PomodoroState = {
  focusMode: "countdown",
  isRunning: false,
  isPaused: false,
  timeLeft: DEFAULT_DURATION,
  duration: DEFAULT_DURATION,
  activeTaskId: null,
  title: null,
  notes: null,
  activeSessionId: null,
  revision: null,
  startedAt: null,
  effectiveDurationSeconds: 0,
  pausedDurationSeconds: 0,
  lastCompletedEffectiveSeconds: 0,
  lastCompletedSessionId: null,
  lastCompletedStartedAt: null,
  lastCompletedEndedAt: null,
  syncError: null,
  todayCount: 0,
  totalFocusMinutes: 0,
};

function stateFromSession(
  current: PomodoroState,
  session: FocusSessionResponse,
): PomodoroState {
  const open = session.status === "active" || session.status === "paused";
  return {
    ...current,
    isRunning: open,
    isPaused: session.status === "paused",
    focusMode: session.focusMode === "countup" ? "countup" : "countdown",
    duration: session.plannedDurationSeconds,
    timeLeft:
      session.focusMode === "countup"
        ? session.effectiveDurationSeconds
        : session.remainingSeconds,
    activeTaskId: session.taskId,
    title: session.title ?? null,
    notes: session.notes ?? null,
    activeSessionId: open ? session.id : null,
    revision: open ? session.revision : null,
    startedAt: session.startedAt,
    effectiveDurationSeconds: session.effectiveDurationSeconds,
    pausedDurationSeconds: session.pausedDurationSeconds,
    lastCompletedEffectiveSeconds:
      session.status === "completed"
        ? session.effectiveDurationSeconds
        : current.lastCompletedEffectiveSeconds,
    lastCompletedSessionId:
      session.status === "completed" ? session.id : current.lastCompletedSessionId,
    lastCompletedStartedAt:
      session.status === "completed" ? session.startedAt : current.lastCompletedStartedAt,
    lastCompletedEndedAt:
      session.status === "completed" ? session.endedAt : current.lastCompletedEndedAt,
    syncError: null,
  };
}

async function readSession(response: Response, sessionId?: string) {
  const body = await response.text();
  if (body.trim()) {
    try { return JSON.parse(body) as FocusSessionResponse; }
    catch { throw new Error('专注状态同步失败，请重试'); }
  }
  const fallback = await apiRequest(sessionId ? '/pomodoro' : '/pomodoro/active');
  const data = await fallback.json() as FocusSessionResponse[] | FocusSessionResponse | null;
  const session = Array.isArray(data) ? data.find((item) => item.id === sessionId) : data;
  if (!session) throw new Error('专注状态同步失败，请重试');
  return session;
}

export const createPomodoroSlice: StateCreator<
  AppState,
  [],
  [],
  PomodoroSlice
> = (set, get) => ({
  pomodoro: { ...INITIAL_POMODORO },

  startPomodoro: async (taskId, durationMinutes = 25, focusMode = "countdown", title, notes) => {
    const res = await apiRequest("/pomodoro", {
      method: "POST",
      body: JSON.stringify({
        taskId,
        title,
        notes,
        duration: durationMinutes,
        focusMode,
        clientRequestId: crypto.randomUUID(),
      }),
    });
    const session = await readSession(res);
    set((state) => ({ pomodoro: stateFromSession(state.pomodoro, session) }));
  },

  loadActivePomodoro: async () => {
    try {
      const res = await apiRequest("/pomodoro/active");
      const body = await res.text();
      const session = body.trim() ? JSON.parse(body) as FocusSessionResponse | null : null;
      if (!session) {
        set((state) => ({
          pomodoro: {
            ...state.pomodoro,
            isRunning: false,
            isPaused: false,
            activeTaskId: null,
            activeSessionId: null,
            revision: null,
            startedAt: null,
          },
        }));
        return;
      }
      set((state) => ({ pomodoro: stateFromSession(state.pomodoro, session) }));
      if (session.status === "completed") {
        window.dispatchEvent(new Event("sparkflow:calendar-changed"));
        window.dispatchEvent(new Event("sparkflow:actual-changed"));
        await get().loadPomodoroStats();
      }
    } catch (error) {
      set((state) => ({
        pomodoro: {
          ...state.pomodoro,
          syncError:
            error instanceof Error ? error.message : "专注状态同步失败",
        },
      }));
    }
  },

  pausePomodoro: async () => {
    const { activeSessionId, revision } = get().pomodoro;
    if (!activeSessionId) return;
    const res = await apiRequest(`/pomodoro/${activeSessionId}/pause`, {
      method: "POST",
      body: JSON.stringify({ revision }),
    });
    const session = await readSession(res, activeSessionId);
    set((state) => ({ pomodoro: stateFromSession(state.pomodoro, session) }));
  },

  resumePomodoro: async () => {
    const { activeSessionId, revision } = get().pomodoro;
    if (!activeSessionId) return;
    const res = await apiRequest(`/pomodoro/${activeSessionId}/resume`, {
      method: "POST",
      body: JSON.stringify({ revision }),
    });
    const session = await readSession(res, activeSessionId);
    set((state) => ({ pomodoro: stateFromSession(state.pomodoro, session) }));
  },

  stopPomodoro: async () => {
    const { activeSessionId, revision } = get().pomodoro;
    if (!activeSessionId) return;
    await apiRequest(`/pomodoro/${activeSessionId}/interrupt`, {
      method: "POST",
      body: JSON.stringify({ revision }),
    });
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
        isPaused: false,
        timeLeft: state.pomodoro.duration,
        activeTaskId: null,
        title: null,
        notes: null,
        activeSessionId: null,
        revision: null,
        startedAt: null,
        syncError: null,
      },
    }));
    window.dispatchEvent(new Event("sparkflow:actual-changed"));
    await get().loadPomodoroStats();
  },

  tick: () =>
    set((state) => {
      if (!state.pomodoro.isRunning || state.pomodoro.isPaused) return state;
      if (state.pomodoro.focusMode === "countup") {
        return {
          pomodoro: {
            ...state.pomodoro,
            timeLeft: state.pomodoro.timeLeft + 1,
            effectiveDurationSeconds: state.pomodoro.effectiveDurationSeconds + 1,
          },
        };
      }
      const newTime = Math.max(0, state.pomodoro.timeLeft - 1);
      if (newTime === 0 && state.pomodoro.timeLeft > 0) {
        void get()
          .completePomodoro()
          .catch((error) => {
            set((latest) => ({
              pomodoro: {
                ...latest.pomodoro,
                syncError:
                  error instanceof Error
                    ? error.message
                    : "专注完成待同步，请重试",
              },
            }));
          });
      }
      return { pomodoro: { ...state.pomodoro, timeLeft: newTime } };
    }),

  completePomodoro: async () => {
    const { activeSessionId, revision } = get().pomodoro;
    if (!activeSessionId) return;
    const res = await apiRequest(`/pomodoro/${activeSessionId}/complete`, {
      method: "POST",
      body: JSON.stringify({ revision }),
    });
    const session = await readSession(res, activeSessionId);
    set((state) => ({
      pomodoro: {
        ...state.pomodoro,
        isRunning: false,
        isPaused: false,
        timeLeft: 0,
        activeTaskId: session.taskId,
        title: session.title ?? null,
        notes: session.notes ?? null,
        activeSessionId: null,
        revision: null,
        effectiveDurationSeconds: session.effectiveDurationSeconds,
        pausedDurationSeconds: session.pausedDurationSeconds,
        lastCompletedEffectiveSeconds: session.effectiveDurationSeconds,
        lastCompletedSessionId: session.id,
        lastCompletedStartedAt: session.startedAt,
        lastCompletedEndedAt: session.endedAt,
        syncError: null,
      },
    }));
    window.dispatchEvent(new Event("sparkflow:calendar-changed"));
    window.dispatchEvent(new Event("sparkflow:actual-changed"));
    await get().loadPomodoroStats();
  },

  loadPomodoroStats: async () => {
    try {
      const res = await apiRequest("/pomodoro/stats");
      const stats = await res.json();
      set((state) => ({
        pomodoro: {
          ...state.pomodoro,
          todayCount: stats.todayCount ?? 0,
          totalFocusMinutes: stats.totalMinutes ?? 0,
        },
      }));
    } catch {
      // Statistics can retry on the next foreground refresh.
    }
  },
});
