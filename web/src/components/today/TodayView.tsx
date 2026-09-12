import { useEffect, useMemo, useState } from 'react';
import { Lock, MapPin } from 'lucide-react';
import { api, DEFAULT_USER_ID } from '../../api/client';
import { useAppStore } from '../../store/appStore';
import type { CalendarEvent, ScheduleItem, Task } from '../../types';
import { computeFreeSlots } from '../../utils/freeSlots';
import { projectScheduleItems } from '../../utils/scheduleProjection';
import FreeTimeCard from './FreeTimeCard';
import RhythmDial from './RhythmDial';
import TodayProgress from './TodayProgress';
import WeekStrip from './WeekStrip';

function dayRange(date: Date) {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(date); end.setHours(23, 59, 59, 999);
  return { start, end };
}

export default function TodayView({ onTaskClick }: { onTaskClick: (task: Task) => void }) {
  const tasks = useAppStore((state) => state.tasks);
  const selectedDate = useAppStore((state) => state.selectedDate);
  const setSelectedDate = useAppStore((state) => state.setSelectedDate);
  const [eventResult, setEventResult] = useState<{ key: string; events: CalendarEvent[] }>({ key: '', events: [] });
  const [now, setNow] = useState(() => new Date());
  const { start, end } = useMemo(() => dayRange(selectedDate), [selectedDate]);
  const rangeKey = `${start.toISOString()}:${end.toISOString()}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.get<CalendarEvent[]>(`/calendar?userId=${DEFAULT_USER_ID}&start=${start.toISOString()}&end=${end.toISOString()}`, { fallback: [] })
      .then((result) => { if (!cancelled) setEventResult({ key: rangeKey, events: result }); })
      .catch(() => { if (!cancelled) setEventResult({ key: rangeKey, events: [] }); });
    return () => { cancelled = true; };
  }, [start, end, rangeKey]);

  const items = useMemo(() => {
    const events = eventResult.key === rangeKey ? eventResult.events : [];
    return projectScheduleItems(tasks, events).filter((item) => {
      const itemStart = new Date(item.start);
      const itemEnd = new Date(item.end);
      return itemStart <= end && itemEnd >= start;
    });
  }, [tasks, eventResult, rangeKey, start, end]);
  const [availableStart, availableEnd] = useMemo(() => {
    const rangeStart = new Date(start); rangeStart.setHours(6);
    const rangeEnd = new Date(start); rangeEnd.setHours(24);
    return [rangeStart, rangeEnd];
  }, [start]);
  const slots = useMemo(() => computeFreeSlots(items, availableStart, availableEnd, 15), [items, availableStart, availableEnd]);
  const referenceNow = selectedDate.toDateString() === now.toDateString() ? now : availableStart;

  const selectItem = (item: ScheduleItem) => {
    if (!item.taskId) return;
    const task = tasks.find((candidate) => candidate.id === item.taskId);
    if (task) onTaskClick(task);
  };

  return (
    <div className="animate-page-enter space-y-4 pb-4">
      <div>
        <h1 className="text-xl font-bold">{selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</h1>
        <p className="text-xs text-[var(--sf-text-tertiary)]">{selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
      </div>
      <WeekStrip selectedDate={selectedDate} onSelect={setSelectedDate} />
      <section className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-4">
        <RhythmDial items={items} now={referenceNow} onSelect={selectItem} />
      </section>
      <FreeTimeCard slots={slots} now={referenceNow} />
      <TodayProgress items={items} />
      <section className="space-y-2">
        <h2 className="text-sm font-bold">今日安排</h2>
        {items.length === 0 && <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4 text-sm text-[var(--sf-text-secondary)]">今天还没有安排，留一点空白也很好。</p>}
        {items.map((item) => (
          <button type="button" key={item.id} onClick={() => selectItem(item)} className="flex w-full items-center gap-3 rounded-[var(--sf-radius-sm)] bg-[var(--sf-surface)] p-3 text-left">
            <span className="h-9 w-1 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.title}</strong><span className="text-xs text-[var(--sf-text-tertiary)]">{new Date(item.start).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })} · {item.durationMinutes} 分钟</span></span>
            {item.location && <MapPin size={13} className="text-[var(--sf-text-tertiary)]" />}
            {item.locked && <Lock size={13} className="text-[var(--sf-text-tertiary)]" />}
          </button>
        ))}
      </section>
    </div>
  );
}
