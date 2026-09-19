import { useEffect, useRef } from 'react';
import { LockKeyhole, Sparkles } from 'lucide-react';
import type { PlanItem } from './planProjection';
import { itemsForLocalDay, localDateKey } from './planProjection';

const START_HOUR = 8;
const END_HOUR = 21;
const HOUR_HEIGHT = 52;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

function minutesOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function cardBackground(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}26` : '#f4f4f6';
}

interface WeekPlanViewProps {
  selectedDate: Date;
  items: PlanItem[];
  onSelectDate: (date: Date) => void;
  onItemClick?: (item: PlanItem) => void;
}

export default function WeekPlanView({ selectedDate, items, onSelectDate, onItemClick }: WeekPlanViewProps) {
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
  const selectedKey = localDateKey(date);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const selectedIndex = days.findIndex((day) => localDateKey(day) === selectedKey);
    if (selectedIndex < 0) return;
    const timeColumnWidth = 48;
    const dayWidth = (scroller.scrollWidth - timeColumnWidth) / 7;
    const targetCenter = timeColumnWidth + (selectedIndex + 0.5) * dayWidth;
    const maxLeft = scroller.scrollWidth - scroller.clientWidth;
    scroller.scrollTo({ left: Math.max(0, Math.min(maxLeft, targetCenter - scroller.clientWidth / 2)) });
  }, [selectedKey]);

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div ref={scrollerRef} className="overflow-x-auto overscroll-x-contain">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[48px_repeat(7,minmax(68px,1fr))] border-b border-black/5 px-1.5 py-2">
            <div className="sticky left-0 z-20 bg-[var(--sf-surface)]" />
            {days.map((day) => (
              <button type="button" key={day.toISOString()} onClick={() => onSelectDate(day)} className="text-center">
                <p className="text-[9px] font-bold text-[var(--sf-text-tertiary)]">{'日一二三四五六'[day.getDay()]}</p>
                <p className={`mx-auto mt-1 grid h-7 w-7 place-items-center rounded-full text-[11px] font-black ${localDateKey(day) === localDateKey(date) ? 'bg-[#242424] text-white' : localDateKey(day) === localDateKey(now) ? 'bg-[#cae393] text-[#242424]' : 'text-[var(--sf-text-primary)]'}`}>
                  {day.getDate()}
                </p>
              </button>
            ))}
          </div>

          <div className="max-h-[62svh] overflow-y-auto">
            <div className="grid grid-cols-[48px_repeat(7,minmax(68px,1fr))] px-1.5">
              <div className="sticky left-0 z-20 bg-[var(--sf-surface)]" style={{ height: TOTAL_HEIGHT }}>
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                  <span
                    key={index}
                    className="absolute right-1 text-[8px] font-semibold text-[var(--sf-text-tertiary)]"
                    style={{ top: index * HOUR_HEIGHT - 5 }}
                  >
                    {String(START_HOUR + index).padStart(2, '0')}:00
                  </span>
                ))}
              </div>

              {days.map((day) => {
                const dayItems = itemsForLocalDay(items, day);
                return (
                  <div key={day.toISOString()} className="relative border-l border-black/[0.05]" style={{ height: TOTAL_HEIGHT }}>
                    {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => (
                      <span
                        key={index}
                        className="absolute left-0 right-0 border-t border-black/[0.045]"
                        style={{ top: index * HOUR_HEIGHT }}
                      />
                    ))}

                    {dayItems.map((item) => {
                      const start = new Date(item.start);
                      const end = new Date(item.end);
                      const visibleStart = Math.max(minutesOfDay(start), START_HOUR * 60);
                      const visibleEnd = Math.min(minutesOfDay(end), END_HOUR * 60);
                      if (visibleEnd <= START_HOUR * 60 || visibleStart >= END_HOUR * 60) return null;
                      const top = ((visibleStart - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                      const height = Math.max(22, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT);
                      const titleMaxHeight = height >= 78 ? 55 : height >= 44 ? 33 : 11;

                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => onItemClick?.(item)}
                          className={`absolute left-1 right-1 z-10 overflow-hidden rounded-md border-l-2 px-1.5 py-1 text-left shadow-sm ${item.preview ? 'outline outline-1 outline-dashed outline-[#8b7fbc]' : ''} ${item.completed ? 'opacity-45' : ''}`}
                          style={{ top, height, borderLeftColor: item.color, backgroundColor: item.preview ? '#eeeafd' : cardBackground(item.color) }}
                          title={item.title}
                        >
                          <span
                            className="block overflow-hidden break-words text-[9px] font-black leading-[11px] text-[#242424]"
                            style={{ maxHeight: titleMaxHeight }}
                          >
                            {item.preview ? '✨ ' : ''}{item.title}
                          </span>
                          {height >= 44 && item.location && (
                            <span className="mt-0.5 block truncate text-[8px] leading-[10px] text-gray-500">@{item.location}</span>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 text-gray-500">
                            {item.scheduleSource === 'ai' && <Sparkles size={8} />}
                            {item.locked && <LockKeyhole size={8} />}
                          </span>
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
