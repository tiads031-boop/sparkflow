/**
 * 辅助数据 Slice
 *
 * 灵感卡片 (Sparks) 和日历事件 (CalendarEvent) 的状态管理。
 * Sparks 为纯前端数据（灵感墙），CalendarEvent 通过 CalendarView#fetchCalendarEvents 拉取。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './index';
import type { Spark, CalendarEvent } from '../types';
import { initialSparks } from './constants';

export interface DataSlice {
  /** 灵感卡片 */
  sparks: Spark[];
  setSparks: (sparks: Spark[]) => void;
  addSpark: (spark: Spark) => void;
  deleteSpark: (id: string) => void;
  updateSpark: (id: string, updates: Partial<Spark>) => void;

  /** 日历事件（课程等） */
  events: CalendarEvent[];
  setEvents: (events: CalendarEvent[]) => void;
  addEvent: (event: CalendarEvent) => void;
  deleteEvent: (id: string) => void;
}

export const createDataSlice: StateCreator<AppState, [], [], DataSlice> = (set) => ({
  sparks: initialSparks,
  setSparks: (sparks) => set({ sparks }),
  addSpark: (spark) => set((state) => ({ sparks: [spark, ...state.sparks] })),
  deleteSpark: (id) =>
    set((state) => ({ sparks: state.sparks.filter((s) => s.id !== id) })),
  updateSpark: (id, updates) =>
    set((state) => ({
      sparks: state.sparks.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) =>
    set((state) => ({ events: [...state.events, event] })),
  deleteEvent: (id) =>
    set((state) => ({ events: state.events.filter((e) => e.id !== id) })),
});
