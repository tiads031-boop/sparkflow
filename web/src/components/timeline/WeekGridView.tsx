import { useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ScheduleItem } from '../../types';
import ScheduleBlock from './ScheduleBlock';
import { addDays, dateKey, isRepeatInstance, moveItemToLocalMinute, resizeItem, startOfWeek, TIMELINE_SNAP_MINUTES, weekDayIndexAtX } from './timelineUtils';

const HOUR_HEIGHT = 56;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;

interface Props {
  date: Date;
  items: ScheduleItem[];
  onSelectItem: (item: ScheduleItem) => void;
  onCreate: (date: Date) => void;
  onMove: (item: ScheduleItem, values: { scheduledStart: string; scheduledEnd: string }) => void;
  onResize: (item: ScheduleItem, values: { estimatedMinutes: number; duration: number; scheduledEnd: string }) => void;
}

export default function WeekGridView({ date, items, onSelectItem, onCreate, onMove, onResize }: Props) {
  const moved = useRef(false);
  const createTimer = useRef<number | null>(null);
  const createCleanup = useRef<(() => void) | null>(null);
  const weekGridRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  useEffect(() => () => {
    createCleanup.current?.();
  }, []);

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, item: ScheduleItem, day: Date, kind: 'move' | 'resize') => {
    if (!item.taskId) return;
    event.preventDefault();
    event.stopPropagation();
    const startY = event.clientY;
    const repeatInstance = isRepeatInstance(item);
    let repeatWarned = false;
    let lockConfirmed = !item.locked;
    let lockPrompted = false;
    let dragAllowed = !repeatInstance;
    moved.current = false;
    const onPointerMove = (pointerEvent: PointerEvent) => {
      if (Math.hypot(pointerEvent.clientX - event.clientX, pointerEvent.clientY - startY) <= 5) return;
      moved.current = true;
      if (repeatInstance) {
        if (!repeatWarned) window.alert('重复任务暂不支持拖动或调整时长，请打开任务编辑重复规则。');
        repeatWarned = true;
        dragAllowed = false;
        return;
      }
      if (!lockPrompted && item.locked) {
        lockPrompted = true;
        lockConfirmed = window.confirm('这是锁定事项。仍要调整它吗？');
      }
      dragAllowed = lockConfirmed;
    };
    const onPointerUp = (pointerEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      const deltaMinutes = ((pointerEvent.clientY - startY) / HOUR_HEIGHT) * 60;
      if (!moved.current || !dragAllowed) return;
      if (kind === 'resize') onResize(item, resizeItem(item, item.durationMinutes + deltaMinutes));
      else {
        const current = new Date(item.start);
        const minute = current.getHours() * 60 + current.getMinutes() + deltaMinutes;
        const gridRect = weekGridRef.current?.getBoundingClientRect();
        const targetDay = gridRect
          ? addDays(weekStart, weekDayIndexAtX(pointerEvent.clientX, gridRect.left + 42, gridRect.width - 42))
          : day;
        onMove(item, moveItemToLocalMinute(item, targetDay, minute));
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
  };

  const createAtPointer = (element: HTMLDivElement, day: Date, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const minute = Math.round(((clientY - rect.top) / HOUR_HEIGHT) * 60 / TIMELINE_SNAP_MINUTES) * TIMELINE_SNAP_MINUTES;
    const start = new Date(day);
    start.setHours(0, minute, 0, 0);
    onCreate(start);
  };

  const beginLongPressCreate = (event: ReactPointerEvent<HTMLDivElement>, day: Date) => {
    if ((event.target as HTMLElement).closest('button')) return;
    createCleanup.current?.();
    const element = event.currentTarget;
    const clientX = event.clientX;
    const clientY = event.clientY;
    createTimer.current = window.setTimeout(() => createAtPointer(element, day, clientY), 500);
    const cancel = () => {
      if (createTimer.current !== null) window.clearTimeout(createTimer.current);
      createTimer.current = null;
      createCleanup.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', cancel);
      window.removeEventListener('pointercancel', cancel);
    };
    const onPointerMove = (pointerEvent: PointerEvent) => {
      if (Math.hypot(pointerEvent.clientX - clientX, pointerEvent.clientY - clientY) > 8) cancel();
    };
    createCleanup.current = cancel;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', cancel, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  };

  return (
    <section className="overflow-x-auto rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)]">
      <div className="min-w-[780px]">
        <div className="sticky top-0 z-20 grid grid-cols-[42px_repeat(7,1fr)] border-b border-[var(--sf-border)] bg-[var(--sf-surface)]">
          <span />{days.map((day) => <span key={dateKey(day)} className="py-2 text-center text-xs font-semibold">{day.toLocaleDateString('zh-CN', { weekday: 'short', day: 'numeric' })}</span>)}
        </div>
        <div ref={weekGridRef} className="grid grid-cols-[42px_repeat(7,1fr)]">
          <div className="relative" style={{ height: DAY_HEIGHT }}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} className="absolute right-2 text-[9px] text-[var(--sf-text-tertiary)]" style={{ top: hour * HOUR_HEIGHT - 6 }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
          {days.map((day) => (
            <div
              key={dateKey(day)}
              className="relative border-l border-[var(--sf-border)] bg-[linear-gradient(to_bottom,var(--sf-border)_1px,transparent_1px)] bg-[length:100%_56px]"
              style={{ height: DAY_HEIGHT }}
              onPointerDown={(event) => beginLongPressCreate(event, day)}
              onDoubleClick={(event) => createAtPointer(event.currentTarget, day, event.clientY)}
            >
              {items.filter((item) => dateKey(new Date(item.start)) === dateKey(day)).map((item) => {
                const start = new Date(item.start);
                const top = (start.getHours() + start.getMinutes() / 60) * HOUR_HEIGHT;
                const height = Math.max(24, item.durationMinutes / 60 * HOUR_HEIGHT);
                return (
                  <ScheduleBlock key={item.id} item={item} compact onClick={() => { if (!moved.current) onSelectItem(item); }} onPointerDown={(event) => beginDrag(event, item, day, 'move')} className="absolute left-1 right-1 z-10 w-[calc(100%-0.5rem)] touch-none" style={{ top, height }}>
                    {item.taskId && <span aria-hidden="true" onPointerDown={(event) => beginDrag(event, item, day, 'resize')} className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize" />}
                  </ScheduleBlock>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
