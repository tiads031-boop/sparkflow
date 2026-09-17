import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { Task } from '../types';

const DAY_WIDTH = 44;
const RANGE_DAYS = 14;
const DAY_MS = 86_400_000;

interface Gesture {
  task: Task;
  mode: 'move' | 'resize';
  startX: number;
  deltaDays: number;
  range: NonNullable<ReturnType<typeof taskRange>>;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function getMonday(value: Date) {
  const date = startOfDay(value);
  const weekday = date.getDay() || 7;
  return addDays(date, 1 - weekday);
}

function diffDays(a: Date, b: Date) {
  return (startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000;
}

function taskRange(task: Task) {
  if (task.scheduledStart) {
    const start = new Date(task.scheduledStart);
    const duration = task.estimatedMinutes ?? task.duration ?? 60;
    const end = task.scheduledEnd ? new Date(task.scheduledEnd) : new Date(start.getTime() + duration * 60_000);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) return { start, end, milestone: false };
  }
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (!Number.isNaN(due.getTime())) return { start: due, end: due, milestone: true };
  }
  return null;
}

function barColor(task: Task) {
  if (task.status === 'Done') return '#c8c8cc';
  if (task.scheduleColor) return task.scheduleColor;
  if (task.priority === 'High Priority') return 'var(--sf-marker-pink)';
  if (task.priority === 'Medium') return 'var(--sf-marker-purple)';
  return 'var(--sf-marker-green)';
}

export default function GanttView({ tasks, selectedDate, onTaskClick }: { tasks: Task[]; selectedDate: Date; onTaskClick?: (task: Task) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [gesturePreview, setGesturePreview] = useState<{ taskId: string; mode: Gesture['mode']; deltaDays: number } | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const suppressClickRef = useRef<string | null>(null);
  const updateTask = useAppStore((state) => state.updateTask);
  const rangeStart = useMemo(() => addDays(getMonday(selectedDate), weekOffset * 7), [selectedDate, weekOffset]);
  const days = useMemo(() => Array.from({ length: RANGE_DAYS }, (_, index) => addDays(rangeStart, index)), [rangeStart]);
  const rangeEnd = addDays(rangeStart, RANGE_DAYS);
  const todayOffset = diffDays(new Date(), rangeStart);

  const { visibleTasks, unscheduledCount } = useMemo(() => {
    const activeTasks = tasks.filter((task) => task.status !== 'Cancelled');
    const unscheduled = activeTasks.filter((task) => task.status !== 'Done' && !taskRange(task)).length;
    const visible = activeTasks.filter((task) => {
      const range = taskRange(task);
      if (!range) return false;
      return range.start < rangeEnd && range.end >= rangeStart;
    });
    return { visibleTasks: visible, unscheduledCount: unscheduled };
  }, [tasks, rangeEnd, rangeStart]);

  const beginGesture = (event: React.PointerEvent<HTMLElement>, task: Task, range: Gesture['range'], mode: Gesture['mode']) => {
    if (task.scheduleLocked || range.milestone && mode === 'resize') return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = { task, range, mode, startX: event.clientX, deltaDays: 0 };
    setGesturePreview({ taskId: task.id, mode, deltaDays: 0 });
  };

  const moveGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    let deltaDays = Math.round((event.clientX - gesture.startX) / DAY_WIDTH);
    if (gesture.mode === 'resize') {
      const minimumDelta = Math.ceil((gesture.range.start.getTime() + 15 * 60_000 - gesture.range.end.getTime()) / DAY_MS);
      deltaDays = Math.max(minimumDelta, deltaDays);
    }
    gesture.deltaDays = deltaDays;
    setGesturePreview({ taskId: gesture.task.id, mode: gesture.mode, deltaDays });
  };

  const endGesture = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    gestureRef.current = null;
    setGesturePreview(null);
    if (gesture.deltaDays === 0) return;
    suppressClickRef.current = gesture.task.id;
    if (gesture.range.milestone) {
      void updateTask(gesture.task.id, { dueDate: new Date(gesture.range.start.getTime() + gesture.deltaDays * DAY_MS).toISOString() });
      return;
    }
    if (gesture.mode === 'resize') {
      void updateTask(gesture.task.id, { scheduledEnd: new Date(gesture.range.end.getTime() + gesture.deltaDays * DAY_MS).toISOString() });
      return;
    }
    void updateTask(gesture.task.id, {
      scheduledStart: new Date(gesture.range.start.getTime() + gesture.deltaDays * DAY_MS).toISOString(),
      scheduledEnd: new Date(gesture.range.end.getTime() + gesture.deltaDays * DAY_MS).toISOString(),
    });
  };

  const cancelGesture = () => {
    gestureRef.current = null;
    setGesturePreview(null);
  };

  return (
    <section className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-4 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">两周计划</h2>
          <p className="mt-1 text-[11px] text-[var(--sf-text-tertiary)]">拖动任务条调整日期，拖右端调整工期；菱形代表截止里程碑</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setWeekOffset((value) => value - 2)} className="h-8 w-8 rounded-full bg-[var(--sf-bg)] text-sm" aria-label="前两周">‹</button>
          <button type="button" onClick={() => setWeekOffset(0)} className="rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[11px] font-semibold">今天</button>
          <button type="button" onClick={() => setWeekOffset((value) => value + 2)} className="h-8 w-8 rounded-full bg-[var(--sf-bg)] text-sm" aria-label="后两周">›</button>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border border-[var(--sf-border)] hide-scrollbar">
        <div className="relative" style={{ minWidth: `${132 + RANGE_DAYS * DAY_WIDTH}px` }}>
          <div className="sticky top-0 z-20 flex h-12 border-b border-[var(--sf-border)] bg-[var(--sf-surface)]">
            <div className="sticky left-0 z-30 flex w-[132px] shrink-0 items-center bg-[var(--sf-surface)] px-3 text-xs font-bold">任务</div>
            {days.map((day) => {
              const isToday = diffDays(day, new Date()) === 0;
              return (
                <div key={day.toISOString()} className={`flex w-11 shrink-0 flex-col items-center justify-center border-l border-[var(--sf-divider)] text-[10px] ${isToday ? 'bg-[var(--sf-marker-green)]/25 font-bold' : ''}`}>
                  <span>{day.toLocaleDateString('zh-CN', { weekday: 'short' }).replace('周', '')}</span>
                  <span className="mt-0.5">{day.getDate()}</span>
                </div>
              );
            })}
          </div>

          {visibleTasks.map((task) => {
            const range = taskRange(task)!;
            const preview = gesturePreview?.taskId === task.id ? gesturePreview : null;
            const rawLeft = diffDays(range.start, rangeStart) * DAY_WIDTH;
            const rawRight = (diffDays(range.end, rangeStart) + (range.milestone ? 0 : 1)) * DAY_WIDTH;
            const previewMove = preview?.mode === 'move' ? preview.deltaDays * DAY_WIDTH : 0;
            const previewResize = preview?.mode === 'resize' ? preview.deltaDays * DAY_WIDTH : 0;
            const left = Math.max(0, rawLeft + previewMove);
            const width = Math.max(14, Math.min(RANGE_DAYS * DAY_WIDTH, rawRight + previewMove + previewResize) - left);
            return (
              <button type="button" key={task.id} onClick={() => {
                if (suppressClickRef.current === task.id) {
                  suppressClickRef.current = null;
                  return;
                }
                onTaskClick?.(task);
              }} className="group flex h-12 w-full border-b border-[var(--sf-divider)] text-left last:border-b-0 focus-ring">
                <span className="sticky left-0 z-10 flex w-[132px] shrink-0 items-center bg-[var(--sf-surface)] px-3 text-xs font-medium group-hover:bg-[var(--sf-bg)]">
                  <span className="truncate">{task.title}</span>
                </span>
                <span className="relative block h-full" style={{ width: `${RANGE_DAYS * DAY_WIDTH}px`, backgroundImage: 'repeating-linear-gradient(to right, transparent 0, transparent 43px, var(--sf-divider) 43px, var(--sf-divider) 44px)' }}>
                  {range.milestone ? (
                    <span
                      className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rotate-45 rounded-[3px] ${task.scheduleLocked ? 'cursor-not-allowed opacity-60' : 'cursor-grab'}`}
                      style={{ left: `${Math.max(4, Math.min(RANGE_DAYS * DAY_WIDTH - 18, rawLeft + previewMove - 7))}px`, backgroundColor: barColor(task), touchAction: 'none' }}
                      onPointerDown={(event) => beginGesture(event, task, range, 'move')}
                      onPointerMove={moveGesture}
                      onPointerUp={endGesture}
                      onPointerCancel={cancelGesture}
                    />
                  ) : (
                    <span
                      className={`absolute top-2.5 h-7 rounded-full px-2 text-[10px] font-semibold leading-7 text-[#242424] ${task.scheduleLocked ? 'cursor-not-allowed opacity-65' : 'cursor-grab'}`}
                      style={{ left: `${left}px`, width: `${width}px`, backgroundColor: barColor(task), touchAction: 'none' }}
                      onPointerDown={(event) => beginGesture(event, task, range, 'move')}
                      onPointerMove={moveGesture}
                      onPointerUp={endGesture}
                      onPointerCancel={cancelGesture}
                    >
                      <span className="block truncate">{task.title}</span>
                      {!task.scheduleLocked ? <span
                        className="absolute bottom-1 right-1 top-1 w-2 cursor-ew-resize rounded-full bg-black/15"
                        onPointerDown={(event) => beginGesture(event, task, range, 'resize')}
                        aria-hidden="true"
                      /> : null}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {todayOffset >= 0 && todayOffset < RANGE_DAYS ? <span className="pointer-events-none absolute bottom-0 top-12 z-10 w-0.5 bg-[var(--sf-text-primary)]/35" style={{ left: `${132 + todayOffset * DAY_WIDTH + DAY_WIDTH / 2}px` }} /> : null}
          {visibleTasks.length === 0 ? <p className="py-10 text-center text-sm text-[var(--sf-text-tertiary)]">这两周还没有已排期任务</p> : null}
        </div>
      </div>
      {unscheduledCount > 0 ? <p className="mt-3 rounded-2xl bg-[var(--sf-bg)] px-4 py-3 text-xs text-[var(--sf-text-secondary)]">另有 {unscheduledCount} 项未排期任务，可在列表或 AI 安排中补充时间。</p> : null}
    </section>
  );
}
