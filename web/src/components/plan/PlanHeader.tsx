import { ArrowLeft, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import type { PlanView } from '../../types';
import ScheduleViewPicker, { type ScheduleView } from './ScheduleViewPicker';

interface PlanHeaderProps {
  view: PlanView | 'today';
  title: string;
  subtitle?: string;
  onSelectView: (view: ScheduleView) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onBack?: () => void;
  onPlanner: () => void;
}

export default function PlanHeader({ view, title, subtitle, onSelectView, onPrevious, onNext, onToday, onBack, onPlanner }: PlanHeaderProps) {
  const actual = view === 'timeline';
  return (
    <header className="px-4 pb-4 pt-1">
      {view === 'today' && <p className="text-xs font-bold text-[var(--sf-text-secondary)]">{title}</p>}
      <div className="flex items-center justify-between gap-3">
        {actual ? (
          <div className="flex min-w-0 items-center gap-2">
            {onBack && <button type="button" onClick={onBack} aria-label="返回上一页" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sf-surface)]"><ArrowLeft size={18} /></button>}
            <h1 className="text-2xl font-black text-[var(--sf-text-primary)]">实际记录</h1>
          </div>
        ) : <ScheduleViewPicker view={view} onChange={onSelectView} />}
        {!actual && <button type="button" onClick={onPlanner} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl bg-[var(--sf-purple-soft)] px-3 text-[var(--sf-text-primary)]"><Sparkles size={16} /><span className="text-xs font-bold">AI 规划</span></button>}
      </div>
      {view !== 'today' && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="min-w-0 text-xs text-[var(--sf-text-secondary)]"><p className="font-bold">{title}</p>{subtitle && <p className="mt-0.5">{subtitle}</p>}</div>
          <div className="flex shrink-0 items-center gap-1" aria-label="日程日期导航">
            <button type="button" onClick={onPrevious} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sf-surface)]" aria-label="上一时间段"><ChevronLeft size={17} /></button>
            <button type="button" onClick={onToday} className="min-h-11 rounded-full bg-[var(--sf-surface)] px-3"><span className="text-xs font-bold">回到今天</span></button>
            <button type="button" onClick={onNext} className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sf-surface)]" aria-label="下一时间段"><ChevronRight size={17} /></button>
          </div>
        </div>
      )}
    </header>
  );
}
