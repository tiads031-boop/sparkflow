import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import type { PlanItem } from './planProjection';
import { itemsForLocalDay, localDateKey } from './planProjection';
import { layoutTimetableIntervals } from './timetableLayout';
import { proposeWeekAdjustment, type WeekAdjustmentMode } from './weekAdjustment';

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 36;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const TIME_COLUMN_WIDTH = 36;
const MIN_DAY_WIDTH = 40;

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function cardBackground(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}26` : '#f4f4f6';
}

function canAdjustWeekTask(item: PlanItem) {
  return Boolean(item.taskId)
    && (item.kind === 'task' || item.kind === 'study-task')
    && !item.preview
    && localDateKey(item.start) === localDateKey(item.end)
    && new Date(item.end).getTime() > new Date(item.start).getTime();
}

interface WeekPlanViewProps {
  selectedDate: Date;
  items: PlanItem[];
  onSelectDate: (date: Date) => void;
  onItemClick?: (item: PlanItem) => void;
  onCreateAt?: (date: Date) => void;
  onAdjustTask?: (item: PlanItem, start: Date, end: Date) => void;
}

export default function WeekPlanView({ selectedDate, items, onSelectDate, onItemClick, onCreateAt, onAdjustTask }: WeekPlanViewProps) {
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  const adjustmentRef = useRef<{
    item: PlanItem; day: Date; mode: WeekAdjustmentMode; x: number; y: number;
    columnWidth: number; moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const draftRef = useRef<{ id: string; start: Date; end: Date; offsetX: number } | null>(null);
  const [draft, setDraft] = useState<{ id: string; start: Date; end: Date; offsetX: number } | null>(null);
  useEffect(() => {
    if (gridScrollRef.current) gridScrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressOrigin.current = null;
  };
  useEffect(() => () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  }, []);
  const startPress = (event: PointerEvent<HTMLDivElement>, day: Date) => {
    if (!onCreateAt || event.button !== 0 || (event.target as Element).closest('button')) return;
    cancelPress();
    const rect = event.currentTarget.getBoundingClientRect();
    const minutes = Math.min(23 * 60 + 45, Math.max(0, Math.round((event.clientY - rect.top) / HOUR_HEIGHT * 4) * 15));
    const start = new Date(day);
    start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    pressOrigin.current = { x: event.clientX, y: event.clientY };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      pressOrigin.current = null;
      onCreateAt(start);
    }, 500);
  };
  const movePress = (event: PointerEvent<HTMLDivElement>) => {
    if (pressOrigin.current && Math.hypot(event.clientX - pressOrigin.current.x, event.clientY - pressOrigin.current.y) > 8) cancelPress();
  };
  const beginAdjustment = (event: PointerEvent<HTMLButtonElement>, item: PlanItem, day: Date, mode: WeekAdjustmentMode) => {
    if (!onAdjustTask || !canAdjustWeekTask(item) || event.button !== 0) return;
    const columnWidth = event.currentTarget.parentElement?.getBoundingClientRect().width || MIN_DAY_WIDTH;
    adjustmentRef.current = { item, day, mode, x: event.clientX, y: event.clientY, columnWidth, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveAdjustment = (event: PointerEvent<HTMLButtonElement>) => {
    const active = adjustmentRef.current;
    if (!active) return;
    if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) <= 8) return;
    active.moved = true;
    const dayIndex = (active.day.getDay() + 6) % 7;
    const dayOffset = Math.max(-dayIndex, Math.min(6 - dayIndex, Math.round((event.clientX - active.x) / active.columnWidth)));
    const next = proposeWeekAdjustment(
      new Date(active.item.start), new Date(active.item.end), active.day,
      (event.clientY - active.y) / HOUR_HEIGHT * 60, dayOffset, active.mode,
    );
    draftRef.current = next ? { id: active.item.id, offsetX: active.mode === 'move' ? dayOffset * active.columnWidth : 0, ...next } : null;
    setDraft(draftRef.current);
  };
  const finishAdjustment = (event: PointerEvent<HTMLButtonElement>) => {
    const active = adjustmentRef.current;
    if (!active) return;
    adjustmentRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (active.moved) {
      suppressClick.current = true;
      if (draftRef.current?.id === active.item.id) onAdjustTask?.(active.item, draftRef.current.start, draftRef.current.end);
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    draftRef.current = null;
    setDraft(null);
  };
  const date = new Date(selectedDate.getTime());
  const monday = new Date(date);
  const offset = (date.getDay() + 6) % 7;
  monday.setDate(date.getDate() - offset);
  monday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + index);
    return day;
  });
  const now = new Date();

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--sf-border)] bg-[var(--sf-surface)]">
      <div className="w-full overflow-x-auto overscroll-x-contain" aria-label="周日程横向滚动区域">
        <div style={{ minWidth: TIME_COLUMN_WIDTH + 7 * MIN_DAY_WIDTH }}>
          <div
            className="grid border-b border-black/5 px-1 py-2"
            style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(7, minmax(${MIN_DAY_WIDTH}px, 1fr))` }}
          >
            <div className="sticky left-0 z-20 bg-[var(--sf-surface)]" />
            {days.map((day) => (
              <button type="button" key={day.toISOString()} onClick={() => onSelectDate(day)} className="text-center">
                <p className="text-[8px] font-bold text-[var(--sf-text-tertiary)]">{'日一二三四五六'[day.getDay()]}</p>
                <p className={`mx-auto mt-1 grid h-6 w-6 place-items-center rounded-full text-[10px] font-black ${localDateKey(day) === localDateKey(date) ? 'bg-[#242424] text-white' : localDateKey(day) === localDateKey(now) ? 'bg-[#cae393] text-[#242424]' : 'text-[var(--sf-text-primary)]'}`}>
                  {day.getDate()}
                </p>
              </button>
            ))}
          </div>

          <div ref={gridScrollRef} className="max-h-[66svh] overflow-y-auto">
            <div
              className="grid px-1"
              style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(7, minmax(${MIN_DAY_WIDTH}px, 1fr))` }}
            >
              <div className="sticky left-0 z-20 bg-[var(--sf-surface)]" style={{ height: TOTAL_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                  <span
                    key={index}
                    className="absolute right-1 text-[8px] font-semibold text-[var(--sf-text-tertiary)]"
                    style={{ top: index * HOUR_HEIGHT + 2 }}
                  >
                    {String(START_HOUR + index).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {days.map((day) => {
                const dayItems = itemsForLocalDay(items, day);
                const itemLayouts = layoutTimetableIntervals(dayItems.flatMap((item) => {
                  const start = new Date(item.start);
                  const end = new Date(item.end);
                  const visibleStart = localDateKey(start) !== localDateKey(day) ? 0 : Math.max(minutesOfDay(start), START_HOUR * 60);
                  const visibleEnd = Math.min(localDateKey(end) !== localDateKey(day) ? 1440 : minutesOfDay(end), END_HOUR * 60);
                  if (visibleEnd <= START_HOUR * 60 || visibleStart >= END_HOUR * 60) return [];
                  return [{
                    item,
                    first: visibleStart,
                    last: Math.max(visibleStart, visibleEnd - 1),
                  }];
                }));

                return (
                  <div
                    key={day.toISOString()}
                    className="relative border-l border-black/[0.05]"
                    style={{ height: TOTAL_HEIGHT, touchAction: "pan-y" }}
                    onPointerDown={(event) => startPress(event, day)}
                    onPointerMove={movePress}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(event) => { if (onCreateAt) event.preventDefault(); }}
                  >
                    {Array.from({ length: (END_HOUR - START_HOUR) * 2 + 1 }, (_, index) => (
                      <span
                        key={index}
                        className={`absolute left-0 right-0 border-t ${index % 2 === 0 ? 'border-black/[0.07]' : 'border-dashed border-black/[0.035]'}`}
                        style={{ top: index * HOUR_HEIGHT / 2 }}
                      />
                    ))}

                    {localDateKey(day) === localDateKey(now) && (
                      <span
                        className="absolute left-0 right-0 z-20 border-t border-[#8aad42]"
                        style={{ top: ((minutesOfDay(now) - START_HOUR * 60) / 60) * HOUR_HEIGHT }}
                      >
                        <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-[#8aad42]" />
                      </span>
                    )}

                    {itemLayouts.map(({ item, first: visibleStart, last, lane, laneCount }) => {
                      const visibleEnd = last + 1;
                      const top = ((visibleStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(22, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT);
                      const titleMaxHeight = height >= 78 ? 50 : height >= 44 ? 30 : 10;
                      const lanePosition = laneCount === 1
                        ? { left: 2, right: 2 }
                        : {
                            left: `calc(${(lane * 100) / laneCount}% + 1px)`,
                            width: `calc(${100 / laneCount}% - 2px)`,
                          };

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            if (suppressClick.current) { suppressClick.current = false; return; }
                            onItemClick?.(item);
                          }}
                          onPointerDown={(event) => beginAdjustment(event, item, day, (event.target as Element).closest('[data-resize]') ? 'resize' : 'move')}
                          onPointerMove={moveAdjustment}
                          onPointerUp={finishAdjustment}
                          onPointerCancel={(event) => { adjustmentRef.current = null; draftRef.current = null; setDraft(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                          className={`absolute z-10 overflow-hidden rounded-[9px] border-l-2 px-1 py-1 text-left shadow-sm ${canAdjustWeekTask(item) && onAdjustTask ? 'touch-none cursor-grab active:cursor-grabbing' : ''} ${item.preview ? 'outline outline-1 outline-dashed outline-[#8b7fbc]' : ''} ${item.completed ? 'opacity-45' : ''}`}
                          style={{
                            top: draft?.id === item.id ? ((draft.start.getHours() * 60 + draft.start.getMinutes()) / 60) * HOUR_HEIGHT : top,
                            height: draft?.id === item.id ? Math.max(22, (draft.end.getTime() - draft.start.getTime()) / 3_600_000 * HOUR_HEIGHT) : height,
                            transform: draft?.id === item.id && draft.offsetX ? `translateX(${draft.offsetX}px)` : undefined,
                            ...lanePosition,
                            borderLeftColor: item.color,
                            backgroundColor: item.preview ? '#eeeafd' : cardBackground(item.color),
                          }}
                          title={`${item.title}${item.sourceLabel ? ` · ${item.sourceLabel}` : ''}`}
                        >
                          <span
                            className="block overflow-hidden break-words text-[8px] font-black leading-[10px] text-[#242424]"
                            style={{ maxHeight: titleMaxHeight }}
                          >
                            {item.preview ? '✨ ' : ''}{item.title}
                          </span>
                          {height >= 44 && laneCount === 1 && (item.location || item.sourceLabel?.includes('日历')) && (
                            <span className="mt-0.5 block truncate text-[7px] leading-[9px] text-gray-500">
                              {item.sourceLabel?.includes('日历') ? item.sourceLabel : `@${item.location}`}
                            </span>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 text-gray-500">
                            {item.scheduleSource === 'ai' && <Sparkles size={7} />}
                            {item.locked && <LockKeyhole size={7} />}
                          </span>
                          {canAdjustWeekTask(item) && onAdjustTask && (
                            <span data-resize="true" className="absolute bottom-0 left-0 right-4 z-10 h-1.5 cursor-ns-resize rounded-b-[5px] bg-black/10" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
