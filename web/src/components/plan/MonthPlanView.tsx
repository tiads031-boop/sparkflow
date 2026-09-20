import { CalendarClock } from 'lucide-react';
import type { PlanItem } from './planProjection';
import { itemsForLocalDay, localDateKey } from './planProjection';

interface MonthPlanViewProps {
  selectedDate: Date;
  items: PlanItem[];
  onSelectDate: (date: Date) => void;
  onItemClick?: (item: PlanItem) => void;
}

function itemLabel(item: PlanItem) {
  if (item.kind === 'focus') return '专注';
  if (item.kind === 'course') return '课程';
  if (item.kind === 'study-task') return '学习';
  if (item.kind === 'task') return '任务';
  return '日程';
}

export default function MonthPlanView({ selectedDate, items, onSelectDate, onItemClick }: MonthPlanViewProps) {
  const date = new Date(selectedDate.getTime());
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: mondayOffset + daysInMonth }, (_, index) =>
    index < mondayOffset ? null : index - mondayOffset + 1,
  );
  const today = new Date();
  const selectedItems = itemsForLocalDay(items, selectedDate);

  return (
    <section className="rounded-[1.75rem] bg-[var(--sf-surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Month</p>
          <h2 className="text-lg font-black text-[var(--sf-text-primary)]">{year} 年 {month + 1} 月</h2>
        </div>
        <span className="text-[10px] text-[var(--sf-text-tertiary)]">{items.length} 项安排</span>
      </div>

      <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold text-[var(--sf-text-tertiary)]">
        {'一二三四五六日'.split('').map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <div key={`blank-${index}`} className="aspect-square" />;
          const cellDate = new Date(year, month, day);
          const dayItems = itemsForLocalDay(items, cellDate);
          const active = localDateKey(cellDate) === localDateKey(date);
          const isToday = localDateKey(cellDate) === localDateKey(today);

          return (
            <button
              type="button"
              key={localDateKey(cellDate)}
              onClick={() => onSelectDate(cellDate)}
              className={`min-h-[52px] rounded-xl px-0.5 py-1 text-center transition-colors ${active ? 'bg-[#242424] text-white' : 'hover:bg-[var(--sf-bg)]'}`}
            >
              <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${isToday && !active ? 'bg-[#cae393] text-[#242424]' : ''}`}>
                {day}
              </span>
              <span className="mt-1 flex h-2 items-center justify-center gap-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <span key={item.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                ))}
              </span>
              {dayItems.length > 3 && <span className={`block text-[7px] ${active ? 'text-white/60' : 'text-[var(--sf-text-tertiary)]'}`}>+{dayItems.length - 3}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-black/5 pt-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-[var(--sf-text-tertiary)]">{selectedDate.toLocaleDateString('zh-CN', { weekday: 'long' })}</p>
            <h3 className="text-sm font-black text-[var(--sf-text-primary)]">{selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</h3>
          </div>
          <span className="rounded-full bg-[var(--sf-bg)] px-2 py-1 text-[9px] font-bold text-[var(--sf-text-tertiary)]">{selectedItems.length} 项</span>
        </div>

        <div className="space-y-2">
          {selectedItems.length ? selectedItems.slice(0, 6).map((item) => {
            const start = new Date(item.start);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onItemClick?.(item)}
                className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sf-bg)] px-3 py-2.5 text-left"
              >
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="w-10 shrink-0 text-[10px] font-black text-[var(--sf-text-primary)]">{start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold text-[var(--sf-text-primary)]">{item.title}</span>
                  <span className="block truncate text-[9px] text-[var(--sf-text-tertiary)]">{itemLabel(item)}{item.location ? ` · ${item.location}` : ''}</span>
                </span>
              </button>
            );
          }) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--sf-bg)] px-4 py-6 text-xs text-[var(--sf-text-tertiary)]">
              <CalendarClock size={15} /> 这一天还没有安排
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
