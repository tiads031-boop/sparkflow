import { Check, Loader2, RotateCcw } from 'lucide-react';
import type { PlannerPreview } from '../../types';

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function PlannerPreviewCard({ preview, constraintChips, busy, applied, onApply, onUndo }: {
  preview: PlannerPreview;
  constraintChips: string[];
  busy: boolean;
  applied: boolean;
  onApply: () => void;
  onUndo: () => void;
}) {
  const reasons = [...new Set(preview.proposals.map((proposal) => proposal.reason).filter(Boolean))].slice(0, 2);
  return (
    <div className="mt-4 space-y-3">
      <section className="relative overflow-hidden rounded-[1.7rem] border border-[#cae393]/70 bg-[#f4f8e9] p-4 shadow-sm">
        <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[#b0a8db]/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-[0.18em] text-[#647440]">Preview</span><h3 className="mt-1 text-base font-black text-[#242424]">{preview.proposals.length} 项可执行安排</h3><p className="mt-1 text-[10px] text-[#667252]">确认前不会修改真实日程。</p></div><span className="rounded-full bg-white/70 px-2.5 py-1 text-[9px] font-black text-[#667252]">AI × Scheduler</span></div>
          {constraintChips.length > 0 ? <div className="mt-3 flex flex-wrap gap-1.5">{constraintChips.map((chip) => <span key={chip} className="rounded-full border border-[#a7bc73]/40 bg-white/70 px-2.5 py-1 text-[9px] font-bold text-[#59663e]">{chip}</span>)}</div> : null}
          <div className="mt-3 space-y-2">{preview.proposals.map((proposal) => <article key={proposal.taskId} className="rounded-2xl bg-white/80 px-3 py-2.5"><div className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block truncate text-xs text-[#242424]">{proposal.title}</strong><span className="mt-0.5 block text-[10px] text-[#667252]">{timeLabel(proposal.start)}–{timeLabel(proposal.end)} · {proposal.durationMinutes} 分钟</span></span><Check size={13} className="mt-0.5 shrink-0 text-[#718a3f]" /></div></article>)}</div>
          {preview.unscheduledTaskIds.length > 0 ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[10px] text-amber-800">另有 {preview.unscheduledTaskIds.length} 项未能放入当前时间范围。</p> : null}
          {!applied ? <button type="button" onClick={onApply} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#242424] py-3 text-xs font-black text-[#cae393] disabled:opacity-40">{busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}应用 {preview.proposals.length} 项</button> : <button type="button" onClick={onUndo} disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-xs font-bold text-[#59663e] disabled:opacity-40"><RotateCcw size={14} />撤销本次安排</button>}
        </div>
      </section>
      {reasons.length > 0 ? <section className="rounded-[1.4rem] border border-[#b0a8db]/25 bg-[#f7f5fc] px-4 py-3"><span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#62578f]">为什么这样排</span><div className="mt-2 space-y-1">{reasons.map((reason) => <p key={reason} className="text-[10px] leading-4 text-[#6d6682]">· {reason}</p>)}</div></section> : null}
    </div>
  );
}
