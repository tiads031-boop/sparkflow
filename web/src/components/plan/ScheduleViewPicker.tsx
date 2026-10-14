import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, CalendarRange, ChartNoAxesGantt, Check, ChevronDown, List, Sun, X } from 'lucide-react';
import type { PlanView } from '../../types';
import { useModalLifecycle } from '../ui/useModalLifecycle';

export type ScheduleView = 'today' | Exclude<PlanView, 'timeline'>;

const views = [
  { value: 'today', label: '今天', icon: Sun },
  { value: 'week', label: '周视图', icon: CalendarRange },
  { value: 'month', label: '月视图', icon: CalendarDays },
  { value: 'agenda', label: '日程列表', icon: List },
  { value: 'gantt', label: '甘特图', icon: ChartNoAxesGantt },
] as const;

export default function ScheduleViewPicker({ view, onChange }: {
  view: ScheduleView;
  onChange: (view: ScheduleView) => void;
}) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const panelRef = useRef<HTMLElement>(null);
  useModalLifecycle(open, () => setOpen(false), { isolateAppMain: true });

  useEffect(() => {
    if (open) panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, [open]);

  return (
    <>
      <h1>
        <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined}
          className="flex min-h-11 items-center gap-2 rounded-xl text-[28px] font-black tracking-[-0.04em] text-[var(--sf-text-primary)]">
          {views.find((option) => option.value === view)?.label}<ChevronDown size={20} className="text-[var(--sf-text-secondary)]" />
        </button>
      </h1>
      {open && createPortal(
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/30 px-3 sm:items-center"
          onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section ref={panelRef} id={dialogId} role="dialog" aria-modal="true" aria-labelledby={`${dialogId}-title`}
            className="w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[var(--sf-surface)] p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] shadow-2xl sm:rounded-[28px]"
            style={{ maxHeight: 'calc(100dvh - 24px)' }}
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return;
              const buttons = panelRef.current?.querySelectorAll<HTMLButtonElement>('button');
              const first = buttons?.[0];
              const last = buttons?.[buttons.length - 1];
              if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
              if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }}>
            <div className="mb-2 flex items-center justify-between gap-3 px-2">
              <h2 id={`${dialogId}-title`} className="text-base font-bold text-[var(--sf-text-primary)]">日程视图</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭日程视图" className="grid h-11 w-11 place-items-center rounded-full bg-[var(--sf-bg)] text-[var(--sf-text-secondary)]"><X size={18} /></button>
            </div>
            {views.map(({ value, label, icon: Icon }) => (
              <button type="button" key={value} aria-pressed={view === value} onClick={() => { setOpen(false); onChange(value); }}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold ${view === value ? 'bg-[var(--sf-green)] text-[var(--sf-text-primary)]' : 'text-[var(--sf-text-secondary)]'}`}>
                <Icon size={19} /><span className="flex-1 text-left">{label}</span>{view === value && <Check size={18} />}
              </button>
            ))}
          </section>
        </div>, document.body,
      )}
    </>
  );
}
