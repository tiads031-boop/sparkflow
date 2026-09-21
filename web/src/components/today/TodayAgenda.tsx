import { BookOpen, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react';
import type { PlanItem } from '../plan/planProjection';
import { EmptyState } from '../ui/foundation';

function itemIcon(item: PlanItem) {
  if (item.kind === 'course') return BookOpen;
  if (item.kind === 'calendar') return CalendarClock;
  if (item.completed) return CheckCircle2;
  return ListTodo;
}

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
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Agenda</p>
          <h2 className="text-base font-black text-[var(--sf-text-primary)]">今日日程</h2>
        </div>
        <span className="text-[10px] text-[var(--sf-text-tertiary)]">{items.length} 项</span>
      </div>
      {items.length === 0 ? <EmptyState title="今天还没有排入日程的事项" description="可以新建任务、日程，或让 AI 规划今天。" /> : (
        <div className="overflow-hidden rounded-[24px] border border-[var(--sf-border)] bg-[var(--sf-surface)]">
          {items.map((item) => {
            const Icon = itemIcon(item);
            return (
              <button key={item.id} type="button" onClick={() => onItemClick(item)} className="flex w-full items-center gap-3 border-b border-[var(--sf-divider)] px-4 py-3.5 text-left last:border-0">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl" style={{ backgroundColor: `${item.color}2a`, color: item.color }}><Icon size={16} /></span>
                <span className="min-w-0 flex-1">
                  <strong className={`block truncate text-sm font-extrabold ${item.completed ? 'text-[var(--sf-text-tertiary)] line-through' : 'text-[var(--sf-text-primary)]'}`}>{item.title}</strong>
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
