import { CalendarClock, LockKeyhole, Sparkles } from 'lucide-react';
import type { PlanItem } from './planProjection';
import { itemsForLocalDay } from './planProjection';

interface AgendaPlanViewProps {
  selectedDate: Date;
  items: PlanItem[];
  onItemClick?: (item: PlanItem) => void;
}

function typeLabel(item: PlanItem) {
  if (item.kind === 'course') return '课程';
  if (item.kind === 'study-task') return '学习任务';
  if (item.kind === 'task') return '任务';
  return '日程';
}

export default function AgendaPlanView({ selectedDate, items, onItemClick }: AgendaPlanViewProps) {
  const dayItems = itemsForLocalDay(items, selectedDate);
  const now = new Date();

  return (
    <section className="rounded-[1.75rem] bg-[var(--sf-surface)] p-4 shadow-sm">
      {dayItems.length ? (
        <div className="relative space-y-2 before:absolute before:bottom-2 before:left-[42px] before:top-2 before:w-px before:bg-black/[0.07]">
          {dayItems.map((item) => {
            const start = new Date(item.start);
            const end = new Date(item.end);
            const active = start <= now && end > now;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => onItemClick?.(item)}
                className={`relative flex w-full items-stretch gap-3 rounded-2xl px-2 py-2.5 text-left transition-transform active:scale-[0.99] ${item.preview ? 'border border-dashed border-[#8b7fbc] bg-[#eeeafd]' : active ? 'bg-[#eaf4d6]' : 'bg-[var(--sf-bg)]'} ${item.completed ? 'opacity-50' : ''}`}
              >
                <span className="relative z-10 w-8 shrink-0 pt-1 text-right text-[9px] font-black text-[var(--sf-text-secondary)]">
                  {start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
                <span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-xs font-black text-[var(--sf-text-primary)]">{item.title}</span>
                    {item.scheduleSource === 'ai' && <Sparkles size={10} className="shrink-0 text-[#6f8b31]" />}
                    {item.locked && <LockKeyhole size={10} className="shrink-0 text-[var(--sf-text-tertiary)]" />}
                  </span>
                  <span className="mt-0.5 block text-[9px] text-[var(--sf-text-tertiary)]">
                    {item.preview ? 'AI 预览' : typeLabel(item)} · {start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}–{end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    {item.location ? ` · ${item.location}` : ''}
                  </span>
                  {item.preview && item.reason && <span className="mt-1 block line-clamp-2 text-[9px] text-[#6d638e]">{item.reason}</span>}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--sf-bg)] px-4 py-10 text-xs text-[var(--sf-text-tertiary)]">
          <CalendarClock size={16} /> 今天还没有安排
        </div>
      )}
    </section>
  );
}
