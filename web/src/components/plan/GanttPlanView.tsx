import { useRef, useState, type PointerEvent } from 'react';
import { addLocalDays, localDateKey, type PlanItem } from './planProjection';
import { GANTT_DAYS, GANTT_DAY_WIDTH, ganttDayOffset, ganttRange, proposeGanttAdjustment } from './ganttAdjustment';

type Mode = 'move' | 'resize';
interface Props {
  selectedDate: Date;
  items: PlanItem[];
  onItemClick: (item: PlanItem) => void;
  onAdjustTask?: (item: PlanItem, start: Date, end: Date) => void;
}

export default function GanttPlanView({ selectedDate, items, onItemClick, onAdjustTask }: Props) {
  const { start, end } = ganttRange(selectedDate);
  const days = Array.from({ length: GANTT_DAYS }, (_, index) => addLocalDays(start, index));
  const [draft, setDraft] = useState<{ id: string; days: number; mode: Mode } | null>(null);
  const gesture = useRef<{ item: PlanItem; x: number; days: number; mode: Mode; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const visible = items.filter((item) => new Date(item.start) < end && new Date(item.end) > start);

  const begin = (event: PointerEvent<HTMLButtonElement>, item: PlanItem, mode: Mode) => {
    if (!onAdjustTask || !item.taskId || item.preview || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { item, x: event.clientX, days: 0, mode, moved: false };
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current) return;
    if (!current.moved && Math.abs(event.clientX - current.x) < 8) return;
    current.moved = true;
    current.days = Math.round((event.clientX - current.x) / GANTT_DAY_WIDTH);
    setDraft({ id: current.item.id, days: current.days, mode: current.mode });
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const current = gesture.current;
    if (!current) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDraft(null);
    if (!current.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 0);
    const proposal = proposeGanttAdjustment(current.item, current.days, current.mode);
    if (proposal) onAdjustTask?.(current.item, proposal.start, proposal.end);
  };
  const today = localDateKey(new Date());

  return (
    <section className="rounded-[1.75rem] bg-[var(--sf-surface)] p-3 shadow-sm">
      <p className="mb-3 text-xs text-[var(--sf-text-secondary)]">两周计划 · 点击查看详情，拖动任务调整日期，拖动右端调整结束日期；修改在编辑器中确认。</p>
      <div className="max-h-[65svh] overflow-auto overscroll-x-contain rounded-xl border border-[var(--sf-border)]" aria-label="甘特图横向滚动区域">
        <div style={{ width: 116 + GANTT_DAYS * GANTT_DAY_WIDTH }}>
          <div className="flex h-11 border-b border-[var(--sf-divider)] bg-[var(--sf-surface)]">
            <span className="sticky left-0 z-20 grid w-[116px] shrink-0 place-items-center bg-[var(--sf-surface)] text-xs font-bold">事项</span>
            {days.map((day) => <span key={localDateKey(day)} className={`grid shrink-0 place-items-center border-l border-[var(--sf-divider)] text-[10px] ${localDateKey(day) === today ? 'bg-[#cae393]/40 font-bold' : ''}`} style={{ width: GANTT_DAY_WIDTH }}>
              {day.getMonth() + 1}/{day.getDate()}
            </span>)}
          </div>
          {visible.map((item) => {
            const first = Math.max(0, ganttDayOffset(new Date(item.start), start));
            const last = Math.min(GANTT_DAYS, ganttDayOffset(new Date(item.end), start) + (new Date(item.end).getHours() || new Date(item.end).getMinutes() ? 1 : 0));
            const preview = draft?.id === item.id ? draft : null;
            const from = Math.max(0, Math.min(GANTT_DAYS - 1, first + (preview?.mode === 'move' ? preview.days : 0)));
            const to = Math.max(from + 1, Math.min(GANTT_DAYS, last + (preview ? preview.days : 0)));
            const editable = Boolean(item.taskId && !item.preview && onAdjustTask);
            return <div key={item.id} className="flex h-11 border-b border-[var(--sf-divider)] last:border-b-0">
              <button type="button" onClick={() => onItemClick(item)} className="sticky left-0 z-10 w-[116px] shrink-0 truncate bg-[var(--sf-surface)] px-2 text-left text-[11px] font-medium" title={item.title}>{item.title}</button>
              <div className="relative" style={{ width: GANTT_DAYS * GANTT_DAY_WIDTH, backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent ${GANTT_DAY_WIDTH - 1}px, var(--sf-divider) ${GANTT_DAY_WIDTH - 1}px, var(--sf-divider) ${GANTT_DAY_WIDTH}px)` }}>
                <button type="button" aria-label={`${item.title}，${item.sourceLabel || (item.kind === 'course' ? '课程' : '任务')}，查看详情`}
                  onClick={() => { if (!suppressClick.current) onItemClick(item); }}
                  onPointerDown={(event) => begin(event, item, (event.target as HTMLElement).closest('[data-resize]') ? 'resize' : 'move')} onPointerMove={move} onPointerUp={finish}
                  onPointerCancel={() => { gesture.current = null; setDraft(null); }}
                  className={`absolute top-2 flex h-7 items-center overflow-hidden rounded-full px-2 text-[10px] font-bold focus-ring ${item.preview ? 'border border-dashed' : ''} ${editable ? 'cursor-grab touch-pan-y' : ''}`}
                  style={{ left: from * GANTT_DAY_WIDTH + 3, width: Math.max(16, (to - from) * GANTT_DAY_WIDTH - 6), backgroundColor: item.color, opacity: item.completed ? 0.55 : 1 }}>
                  <span className="truncate">{item.title}</span>
                  {editable && <span data-resize aria-hidden="true" className="absolute inset-y-1 right-0 w-3 cursor-ew-resize rounded-r-full bg-black/20" />}
                </button>
              </div>
            </div>;
          })}
          {!visible.length && <p className="py-10 text-center text-xs text-[var(--sf-text-tertiary)]">这两周还没有已排期事项</p>}
        </div>
      </div>
    </section>
  );
}
