import type { ScheduleItem } from '../../types';
import ScheduleBlock from './ScheduleBlock';
import { addDays, dateKey, sameDay, startOfDay } from './timelineUtils';

interface Props { date: Date; items: ScheduleItem[]; onSelectDate: (date: Date) => void; onSelectItem: (item: ScheduleItem) => void }

export default function MonthView({ date, items, onSelectDate, onSelectItem }: Props) {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const byDay = new Map<string, ScheduleItem[]>();
  items.forEach((item) => {
    const key = dateKey(new Date(item.start));
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  });

  return (
    <section className="rounded-[var(--sf-radius-lg)] bg-[var(--sf-surface)] p-3">
      <div className="grid grid-cols-7 text-center text-[10px] text-[var(--sf-text-tertiary)]">{['日', '一', '二', '三', '四', '五', '六'].map((label) => <span key={label} className="py-2">{label}</span>)}</div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl bg-[var(--sf-border)]">
        {Array.from({ length: 42 }, (_, index) => addDays(gridStart, index)).map((day) => {
          const dayItems = byDay.get(dateKey(day)) ?? [];
          return (
            <div key={dateKey(day)} className={`min-h-20 bg-[var(--sf-surface)] p-1 ${day.getMonth() !== date.getMonth() ? 'opacity-35' : ''}`}>
              <button type="button" onClick={() => onSelectDate(startOfDay(day))} className={`mb-1 h-6 w-6 rounded-full text-[11px] ${sameDay(day, new Date()) ? 'bg-[var(--sf-text-primary)] text-[var(--sf-surface)]' : ''}`}>{day.getDate()}</button>
              <div className="space-y-0.5">{dayItems.slice(0, 2).map((item) => <ScheduleBlock key={item.id} item={item} compact onClick={() => onSelectItem(item)} className="w-full" />)}</div>
              {dayItems.length > 2 && <button type="button" onClick={() => onSelectDate(startOfDay(day))} className="px-1 text-[9px] font-bold text-[var(--sf-text-secondary)]">+{dayItems.length - 2}</button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

