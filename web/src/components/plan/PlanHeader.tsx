import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { PlanView } from '../../types';

const viewLabels: Record<PlanView, string> = {
  month: '月视图',
  week: '周视图',
  agenda: '今天',
};

interface PlanHeaderProps {
  view: PlanView;
  title: string;
  subtitle: string;
  viewMenuOpen: boolean;
  onToggleViewMenu: () => void;
  onSelectView: (view: PlanView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export default function PlanHeader({
  view,
  title,
  subtitle,
  viewMenuOpen,
  onToggleViewMenu,
  onSelectView,
  onPrevious,
  onNext,
  onToday,
}: PlanHeaderProps) {
  return (
    <header className="relative px-4 pb-3 pt-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onToday} className="min-w-0 text-left">
          <p className="truncate text-[11px] font-bold text-[var(--sf-text-tertiary)]">{subtitle}</p>
          <h1 className="mt-0.5 truncate text-xl font-black text-[var(--sf-text-primary)]">{title}</h1>
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={onToggleViewMenu} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sf-surface)] px-3 py-1.5 text-xs font-bold text-[var(--sf-text-primary)] shadow-sm" aria-expanded={viewMenuOpen}>
          <CalendarRange size={14} /> {viewLabels[view]} <ChevronDown size={13} />
        </button>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onPrevious} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)] shadow-sm" aria-label="上一时间段">
            <ChevronLeft size={15} />
          </button>
          <button type="button" onClick={onNext} className="grid h-8 w-8 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-secondary)] shadow-sm" aria-label="下一时间段">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {viewMenuOpen && (
        <div className="absolute left-4 top-[86px] z-30 w-44 rounded-2xl border border-black/5 bg-[var(--sf-surface)] p-1.5 shadow-xl">
          {(Object.keys(viewLabels) as PlanView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSelectView(item)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${item === view ? 'bg-[#eaf4d6] text-[#242424]' : 'text-[var(--sf-text-secondary)]'}`}
            >
              {viewLabels[item]}
              {item === view && <span className="h-2 w-2 rounded-full bg-[#242424]" />}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}
