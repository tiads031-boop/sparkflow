import { BrainCircuit, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlanView } from '../../types';
import GlassSurface from '../ui/GlassSurface';

const viewLabels: Record<PlanView, string> = {
  week: '周',
  month: '月',
  agenda: '日程',
  timeline: '实际',
  gantt: '甘特',
};

interface PlanHeaderProps {
  view: PlanView;
  title: string;
  subtitle: string;
  onSelectView: (view: PlanView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPlanner: () => void;
}

export function PlanTitleBar({
  view,
  title,
  subtitle,
  onPrevious,
  onNext,
  onToday,
}: Pick<PlanHeaderProps, 'view' | 'title' | 'subtitle' | 'onPrevious' | 'onNext' | 'onToday'>) {
  return (
    <div className="flex items-end justify-between gap-3">
      <button type="button" onClick={onToday} className="min-w-0 text-left" title="返回今天">
        <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">{title} · {subtitle}</p>
        <h1 className="mt-1 text-[26px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">{view === 'timeline' ? '实际时间' : '计划'}</h1>
      </button>
      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrevious} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)] shadow-sm" aria-label="上一时间段"><ChevronLeft size={16} /></button>
        <button type="button" onClick={onNext} className="grid h-9 w-9 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)] shadow-sm" aria-label="下一时间段"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
}

export function PlanViewToolbar({ view, onSelectView, onPlanner }: Pick<PlanHeaderProps, 'view' | 'onSelectView' | 'onPlanner'>) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <GlassSurface variant="surface" className="grid min-w-0 flex-1 grid-cols-3 p-1" role="group" aria-label="计划视图">
        {(['week', 'month', 'gantt'] as PlanView[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === view}
            onClick={() => onSelectView(item)}
            className={`rounded-2xl px-2 py-2 text-[10px] font-extrabold transition ${item === view ? 'bg-[var(--sf-graphite)] text-[var(--sf-bg)]' : 'text-[var(--sf-text-secondary)]'}`}
          >
            {viewLabels[item]}
          </button>
        ))}
      </GlassSurface>
      <button type="button" onClick={onPlanner} className="grid h-11 w-11 shrink-0 place-items-center rounded-[18px] bg-[var(--sf-purple)] text-[#302b41]" aria-label="打开 AI 规划"><BrainCircuit size={18} /></button>
    </div>
  );
}

export default function PlanHeader(props: PlanHeaderProps) {
  return (
    <header className="px-4 pb-4 pt-1">
      <PlanTitleBar {...props} />
      <PlanViewToolbar {...props} />
    </header>
  );
}
