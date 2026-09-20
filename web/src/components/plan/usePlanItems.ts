import { useEffect, useMemo, useState } from 'react';
import { api, DEFAULT_USER_ID } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent, PlanView } from '../../types';
import { buildPlanItems, getPlanRange, type PlanItem } from './planProjection';

export interface PlanDataState {
  items: PlanItem[];
  calendarEvents: CalendarEvent[];
  loading: boolean;
  error: string | null;
}

export function usePlanItems(selectedDate: Date, view: PlanView): PlanDataState {
  const tasks = useAppStore((state) => state.tasks);
  const courses = useAppStore((state) => state.courses);
  const semesters = useAppStore((state) => state.semesters);
  const activeSemesterId = useAppStore((state) => state.activeSemesterId);
  const lastGoogleSyncAt = useAppStore((state) => state.lastSyncAt);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calendarRevision, setCalendarRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setCalendarRevision((value) => value + 1);
    window.addEventListener('sparkflow:calendar-changed', refresh);
    return () => window.removeEventListener('sparkflow:calendar-changed', refresh);
  }, []);

  const range = useMemo(() => getPlanRange(selectedDate, view), [selectedDate, view]);
  const rangeStart = range.start.toISOString();
  const rangeEnd = range.end.toISOString();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      userId: DEFAULT_USER_ID,
      start: rangeStart,
      end: rangeEnd,
    });

    void api.get<CalendarEvent[]>(`/calendar?${query.toString()}`, {
      signal: controller.signal,
      throwOnError: true,
    }).then((events) => {
      setCalendarEvents(events || []);
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : '加载日程失败');
      setCalendarEvents([]);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [rangeStart, rangeEnd, lastGoogleSyncAt, calendarRevision]);

  const activeSemester = semesters.find((semester) => semester.id === activeSemesterId) ?? null;
  const items = useMemo(() => buildPlanItems({
    tasks,
    courses,
    calendarEvents,
    semester: activeSemester,
    range,
  }), [tasks, courses, calendarEvents, activeSemester, rangeStart, rangeEnd]);

  return { items, calendarEvents, loading, error };
}
