import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PlannerAdvancedDrawer({ open, summary, detail, count, onToggle, children }: {
  open: boolean;
  summary: string;
  detail: string;
  count: number;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="mt-3">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 rounded-2xl border border-[#b0a8db]/25 bg-[#f7f5fc] px-3 py-2.5 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white text-[#62578f]"><SlidersHorizontal size={14} /></span>
        <span className="min-w-0 flex-1"><strong className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#62578f]">规划依据与高级详情</strong><span className="mt-0.5 block truncate text-xs text-[var(--sf-text-primary)]">{summary}</span><span className="mt-0.5 block text-[9px] text-[var(--sf-text-tertiary)]">{detail} · {count} 条信息</span></span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open ? <div className="mt-2 max-h-[48vh] space-y-4 overflow-y-auto rounded-[1.5rem] border border-black/[0.05] bg-white p-4">{children}</div> : null}
    </section>
  );
}
