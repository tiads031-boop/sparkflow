import { Lock } from 'lucide-react';
import type { ScheduleItem } from '../../types';
import ScheduleBlock from './ScheduleBlock';
import { formatTime } from './timelineUtils';

interface Props { items: ScheduleItem[]; onSelectItem: (item: ScheduleItem) => void }

export default function DayTimelineView({ items, onSelectItem }: Props) {
  return (
    <section className="space-y-2">
      {items.length === 0 && <p className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-5 text-sm text-[var(--sf-text-secondary)]">这一天还没有安排。</p>}
      {items.map((item, index) => {
        const previous = items[index - 1];
        const freeMinutes = previous ? Math.round((new Date(item.start).getTime() - new Date(previous.end).getTime()) / 60_000) : 0;
        return (
          <div key={item.id}>
            {freeMinutes > 0 && <div className="flex items-center gap-3 py-2 text-[10px] text-[var(--sf-text-tertiary)]"><span className="h-px flex-1 bg-[var(--sf-border)]" /><span>空闲 {freeMinutes} 分钟</span><span className="h-px flex-1 bg-[var(--sf-border)]" /></div>}
            <div className="grid grid-cols-[46px_1fr] items-start gap-2">
              <span className="pt-3 text-xs font-semibold text-[var(--sf-text-secondary)]">{formatTime(item.start)}</span>
              <ScheduleBlock item={item} onClick={() => onSelectItem(item)} className="w-full">
                {item.locked && <span className="sr-only"><Lock />固定事项</span>}
              </ScheduleBlock>
            </div>
          </div>
        );
      })}
    </section>
  );
}
