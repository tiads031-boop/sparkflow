import { LockKeyhole, Sparkles } from 'lucide-react';
import type { PlanItem } from './planProjection';
import { itemsForLocalDay, localDateKey } from './planProjection';
import { layoutTimetableIntervals } from './timetableLayout';

const START_HOUR = 0;
const END_HOUR = 24;
const HOUR_HEIGHT = 36;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const TIME_COLUMN_WIDTH = 36;

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

  return (
    <section className="overflow-hidden rounded-[1.75rem] bg-[var(--sf-surface)] shadow-sm">
      <div className="w-full overflow-x-auto overscroll-x-contain" aria-label="周日程横向滚动区域">
        <div style={{ minWidth: TIME_COLUMN_WIDTH + 7 * 84 }}>
          <div
            className="grid border-b border-black/5 px-1 py-2"
            style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(7, minmax(84px, 1fr))` }}
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

          <div className="max-h-[66svh] overflow-y-auto">
            <div
              className="grid px-1"
              style={{ gridTemplateColumns: `${TIME_COLUMN_WIDTH}px repeat(7, minmax(84px, 1fr))` }}
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
                  const visibleStart = Math.max(minutesOfDay(start), START_HOUR * 60);
                  const visibleEnd = Math.min(minutesOfDay(end), END_HOUR * 60);
                  if (visibleEnd <= START_HOUR * 60 || visibleStart >= END_HOUR * 60) return [];
                  return [{
                    item,
                    first: visibleStart,
                    last: Math.max(visibleStart, visibleEnd - 1),
                  }];
                }));

                return (
                  <div key={day.toISOString()} className="relative border-l border-black/[0.05]" style={{ height: TOTAL_HEIGHT }}>
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
                          onClick={() => onItemClick?.(item)}
                          className={`absolute z-10 overflow-hidden rounded-[5px] border-l-2 px-1 py-0.5 text-left shadow-sm ${item.preview ? 'outline outline-1 outline-dashed outline-[#8b7fbc]' : ''} ${item.completed ? 'opacity-45' : ''}`}
                          style={{
                            top,
                            height,
                            ...lanePosition,
                            borderLeftColor: item.color,
                            backgroundColor: item.preview ? '#eeeafd' : cardBackground(item.color),
                          }}
                          title={item.title}
                        >
                          <span
                            className="block overflow-hidden break-words text-[8px] font-black leading-[10px] text-[#242424]"
                            style={{ maxHeight: titleMaxHeight }}
                          >
                            {item.preview ? '✨ ' : ''}{item.title}
                          </span>
                          {height >= 44 && laneCount === 1 && item.location && (
                            <span className="mt-0.5 block truncate text-[7px] leading-[9px] text-gray-500">@{item.location}</span>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 flex items-center gap-0.5 text-gray-500">
                            {item.scheduleSource === 'ai' && <Sparkles size={7} />}
                            {item.locked && <LockKeyhole size={7} />}
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
