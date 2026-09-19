import { CalendarRange, ChevronDown, MoreHorizontal, Plus, Sparkles } from 'lucide-react';
import type { PlanView } from '../../types';

const viewLabels: Record<PlanView, string> = {
  month: '月视图',
  week: '周视图',
  agenda: '日程视图',
  timetable: '时间表',
};

interface PlanHeaderProps {
  view: PlanView;
  viewMenuOpen: boolean;
  onToggleViewMenu: () => void;
  onSelectView: (view: PlanView) => void;
  onQuickAdd: () => void;
  onPlanner: () => void;
}

export default function PlanHeader({
  view,
  viewMenuOpen,
  onToggleViewMenu,
  onSelectView,
  onQuickAdd,
  onPlanner,
}: PlanHeaderProps) {
  const now = new Date();
  const weekNumber = Math.max(1, Math.ceil((((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7));

  return (
    <header className="relative px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+18px)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-[var(--sf-text-tertiary)]">第 {weekNumber} 周</p>
          <h1 className="mt-0.5 text-xl font-black text-[var(--sf-text-primary)]">
            {now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleViewMenu}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm"
            aria-label="切换计划视图"
          >
            <CalendarRange size={18} />
          </button>
          <button
            type="button"
            onClick={onQuickAdd}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-primary)] shadow-sm"
            aria-label="快速添加"
          >
            <Plus size={19} />
          </button>
          <button
            type="button"
            onClick={onPlanner}
            className="grid h-10 w-10 place-items-center rounded-full bg-[#cae393] text-[#242424] shadow-sm"
            aria-label="AI 帮我安排"
          >
            <Sparkles size={18} />
          </button>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--sf-surface)] text-[var(--sf-text-tertiary)] shadow-sm"
            aria-label="更多"
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleViewMenu}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-[var(--sf-surface)] px-3 py-1.5 text-xs font-bold text-[var(--sf-text-primary)] shadow-sm"
      >
        {viewLabels[view]} <ChevronDown size={13} />
      </button>

      {viewMenuOpen && (
        <div className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+96px)] z-30 w-44 rounded-2xl border border-black/5 bg-[var(--sf-surface)] p-1.5 shadow-xl">
          {(Object.keys(viewLabels) as PlanView[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onSelectView(item)}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                item === view ? 'bg-[#eaf4d6] text-[#242424]' : 'text-[var(--sf-text-secondary)]'
              }`}
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
