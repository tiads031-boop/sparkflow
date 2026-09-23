import type { PlanItem } from '../plan/planProjection';
import { EmptyState } from '../ui/foundation';

function time(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function TodayAgenda({ items, onItemClick }: {
  items: PlanItem[];
  onItemClick: (item: PlanItem) => void;
}) {
  return (
    <section>
      <div className="mb-2 flex items-end justify-between px-1">
        <div>
          <h2 className="text-xs font-black text-[var(--sf-text-primary)]">今日日程安排</h2>
        </div>
        <span className="text-[10px] text-[var(--sf-text-tertiary)]">{items.length} 项</span>
      </div>
      {items.length === 0 ? <EmptyState title="今天还没有排入日程的事项" description="可以新建任务、日程，或让 AI 规划今天。" /> : (
        <div className="relative space-y-2.5 before:absolute before:bottom-3 before:left-[45px] before:top-3 before:w-px before:bg-[var(--sf-border)]">
          {items.map((item) => {
            return (
              <button key={item.id} type="button" onClick={() => onItemClick(item)} className="relative grid w-full grid-cols-[38px_10px_minmax(0,1fr)] items-start gap-2 text-left">
                <span className="pt-1 text-right text-[10px] font-black text-[var(--sf-text-primary)]">{time(item.start)}</span>
                <span className="relative z-10 mt-1.5 grid h-2.5 w-2.5 place-items-center rounded-full border-2 border-[var(--sf-bg)]" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 rounded-[18px] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2.5 shadow-[0_4px_14px_rgba(20,25,23,0.05)]">
                  <strong className={`block truncate text-[11px] font-black ${item.completed ? 'text-[var(--sf-text-tertiary)] line-through' : 'text-[var(--sf-text-primary)]'}`}>{item.title}</strong>
                  <span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">{time(item.start)}–{time(item.end)}{item.location ? ` · ${item.location}` : ''}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
