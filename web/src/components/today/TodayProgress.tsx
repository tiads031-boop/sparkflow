import type { ScheduleItem } from '../../types';

export default function TodayProgress({ items }: { items: readonly ScheduleItem[] }) {
  const completed = items.filter((item) => item.completed).length;
  const percent = items.length ? Math.round((completed / items.length) * 100) : 0;
  return (
    <section className="rounded-[var(--sf-radius-md)] bg-[var(--sf-surface)] p-4">
      <div className="flex justify-between text-xs"><span>今日进度</span><span>{completed}/{items.length}</span></div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--sf-divider)]">
        <div className="h-full rounded-full bg-[var(--sf-marker-green)] transition-[width]" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
