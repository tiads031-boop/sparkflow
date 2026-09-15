import { useEffect, useMemo, useState } from 'react';
import { api, DEFAULT_USER_ID } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent, ScheduleItem, Task } from '../../types';
import { projectScheduleItemsForRange } from '../../utils/scheduleProjection';
import DateNavigator from './DateNavigator';
import DayTimelineView from './DayTimelineView';
import MonthView from './MonthView';
import ViewSwitcher, { type TimelineMode } from './ViewSwitcher';
import WeekGridView from './WeekGridView';
import { addDays, startOfDay, startOfWeek } from './timelineUtils';

function initialMode(): TimelineMode {
  return window.matchMedia('(max-width: 767px)').matches ? 'timeline' : 'week';
}

function rangeFor(date: Date, mode: TimelineMode) {
  if (mode === 'month') {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = addDays(monthStart, -monthStart.getDay());
    return { start: gridStart, end: addDays(gridStart, 42) };
  }
  if (mode === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  const start = startOfDay(date);
  return { start, end: addDays(start, 1) };
}

interface Props { onTaskClick?: (task: Task) => void; onCreate?: (date: Date) => void }

export default function TimelineView({ onTaskClick, onCreate }: Props) {
  const tasks = useAppStore((state) => state.tasks);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const updateTask = useAppStore((state) => state.updateTask);
  const lastSyncAt = useAppStore((state) => state.lastSyncAt);
  const [mode, setMode] = useState<TimelineMode>(initialMode);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const range = useMemo(() => rangeFor(selectedDate, mode), [selectedDate, mode]);
  const rangeStartIso = range.start.toISOString();
  const rangeEndIso = range.end.toISOString();

  useEffect(() => {
    let cancelled = false;
    api.get<CalendarEvent[]>(`/calendar?userId=${DEFAULT_USER_ID}&start=${rangeStartIso}&end=${rangeEndIso}`, { fallback: [] })
      .then((result) => { if (!cancelled) setEvents(result); })
      .catch(() => { if (!cancelled) setEvents([]); });
    return () => { cancelled = true; };
  }, [rangeStartIso, rangeEndIso, lastSyncAt]);

  const items = useMemo(() => projectScheduleItemsForRange(tasks, events, range.start, range.end), [tasks, events, range.start, range.end]);
  const dayItems = useMemo(() => {
    const start = startOfDay(selectedDate); const end = addDays(start, 1);
    return items.filter((item) => new Date(item.start) < end && new Date(item.end) > start);
  }, [items, selectedDate]);

  const selectItem = (item: ScheduleItem) => {
    if (!item.taskId) return;
    const task = tasks.find((candidate) => candidate.id === item.taskId);
    if (task) onTaskClick?.(task);
  };
  const update = async (item: ScheduleItem, values: Partial<Task>) => {
    if (!item.taskId) return;
    setMessage(null);
    try { await updateTask(item.taskId, values); }
    catch (error) { setMessage(error instanceof Error ? error.message : '更新时间失败'); }
  };

  return (
    <div className="animate-page-enter space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><DateNavigator date={selectedDate} mode={mode} onChange={setSelectedDate} /><ViewSwitcher value={mode} onChange={setMode} /></div>
      {message && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{message}</p>}
      {mode === 'month' && <MonthView date={selectedDate} items={items} onSelectDate={(date) => { setSelectedDate(date); setMode('timeline'); }} onSelectItem={selectItem} />}
      {mode === 'week' && <WeekGridView date={selectedDate} items={items} onSelectItem={selectItem} onCreate={(date) => { setSelectedDate(date); onCreate?.(date); }} onMove={(item, values) => void update(item, values)} onResize={(item, values) => void update(item, values)} />}
      {mode === 'timeline' && <DayTimelineView items={dayItems} onSelectItem={selectItem} />}
    </div>
  );
}
