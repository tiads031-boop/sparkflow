import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TimelineMode } from './ViewSwitcher';

export default function DateNavigator({ date, mode, onChange }: { date: Date; mode: TimelineMode; onChange: (date: Date) => void }) {
  const move = (direction: number) => {
    const next = new Date(date);
    if (mode === 'month') next.setMonth(next.getMonth() + direction);
    else next.setDate(next.getDate() + direction * (mode === 'week' ? 7 : 1));
    onChange(next);
  };
  const label = mode === 'month'
    ? date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
    : date.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });

  return (
    <div className="flex min-w-0 items-center gap-1">
      <button type="button" aria-label="上一段日期" onClick={() => move(-1)} className="rounded-full bg-[var(--sf-surface)] p-2"><ChevronLeft size={16} /></button>
      <button type="button" onClick={() => onChange(new Date())} className="min-w-24 truncate px-2 text-sm font-bold" title="回到今天">{label}</button>
      <button type="button" aria-label="下一段日期" onClick={() => move(1)} className="rounded-full bg-[var(--sf-surface)] p-2"><ChevronRight size={16} /></button>
    </div>
  );
}

