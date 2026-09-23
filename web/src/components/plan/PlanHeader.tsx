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
const visibleViews: PlanView[] = ['week', 'month', 'gantt'];

interface PlanHeaderProps {
  view: PlanView;
  title: string;
  subtitle: string;
  onSelectView: (view: PlanView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onPlanner: () => void;
  section?: 'calendar' | 'tasks';
  onSectionChange?: (section: 'calendar' | 'tasks') => void;
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
    <div className="flex items-start justify-between gap-3">
      <button type="button" onClick={onToday} className="min-w-0 text-left" title="返回今天">
        <h1 className="text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">{view === 'timeline' ? '实际时间' : '计划'}</h1>
        <p className="mt-0.5 truncate text-[11px] text-[var(--sf-text-secondary)]">{title} · {subtitle}</p>
      </button>
      <div className="flex items-center gap-0.5 pt-2">
        <button type="button" onClick={onPrevious} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)]" aria-label="上一时间段"><ChevronLeft size={15} /></button>
        <button type="button" onClick={onNext} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)]" aria-label="下一时间段"><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

export function PlanViewToolbar({ view, onSelectView, onPlanner }: Pick<PlanHeaderProps, 'view' | 'onSelectView' | 'onPlanner'>) {
  return (
    <div className="mt-3 flex items-center gap-2">
      <GlassSurface variant="surface" className="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-[18px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-1 shadow-[0_5px_18px_rgba(30,40,30,.045)] hide-scrollbar" role="group" aria-label="计划视图">
        {visibleViews.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={item === view}
            onClick={() => onSelectView(item)}
            className={`shrink-0 rounded-[13px] px-3 py-1.5 text-[11px] font-extrabold transition ${item === view ? 'bg-[var(--sf-graphite)] text-[var(--sf-green)] shadow-sm' : 'text-[var(--sf-text-secondary)]'}`}
          >
            {viewLabels[item]}
          </button>
        ))}
      </GlassSurface>
      <button type="button" onClick={onPlanner} className="flex h-[30px] shrink-0 items-center gap-1 rounded-[13px] border border-[#e3e8dd] bg-[linear-gradient(135deg,#e8f4d1,#f2edfb)] px-2 text-[9px] font-black text-[#303630] shadow-[0_5px_12px_rgba(31,37,33,.06)]" aria-label="打开 AI 规划"><span className="grid h-[18px] w-[18px] place-items-center rounded-[7px] bg-[var(--sf-graphite)] text-[var(--sf-green)]"><BrainCircuit size={12} /></span><span>AI 规划</span></button>
    </div>
  );
}

export default function PlanHeader(props: PlanHeaderProps) {
  return (
    <header className="pb-3 pt-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1"><PlanTitleBar {...props} /></div>
        {props.onSectionChange && <div className="flex shrink-0 gap-0.5 rounded-2xl border border-[#e2e6e3] bg-[#e9ece9] p-1" role="group" aria-label="计划工作区">
          {(['calendar', 'tasks'] as const).map((section) => <button key={section} type="button" onClick={() => props.onSectionChange?.(section)} aria-pressed={props.section === section} className={`rounded-xl px-2.5 py-1.5 text-[10px] font-black ${props.section === section ? 'bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm' : 'text-[var(--sf-text-secondary)]'}`}>{section === 'calendar' ? '日历' : '待办'}</button>)}
        </div>}
      </div>
      {props.section !== 'tasks' && <PlanViewToolbar {...props} />}
    </header>
  );
}
