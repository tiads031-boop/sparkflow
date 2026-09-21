import { Plus } from 'lucide-react';
import type { ActualTimelineGapValue } from './executionMatching';

function time(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function ActualTimelineGap({ gap, onAdd }: { gap: ActualTimelineGapValue; onAdd: (gap: ActualTimelineGapValue) => void }) {
  return (
    <button type="button" onClick={() => onAdd(gap)} className="ml-[42px] flex w-[calc(100%-42px)] items-center justify-between rounded-2xl border border-dashed border-[var(--sf-border)] bg-[var(--sf-bg)]/60 px-3 py-2 text-left">
      <span><strong className="block text-[10px] text-[var(--sf-text-secondary)]">{time(gap.start)} → {time(gap.end)} · {gap.minutes}m 空白</strong><span className="text-[9px] text-[var(--sf-text-tertiary)]">可补记未使用计时器的投入</span></span>
      <span className="inline-flex items-center gap-1 text-[9px] font-black text-[var(--sf-text-secondary)]"><Plus size={11} /> 添加时间块</span>
    </button>
  );
}
