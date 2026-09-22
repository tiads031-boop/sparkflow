import { Plus } from 'lucide-react';
import { SectionCard, SegmentControl } from '../ui/foundation';

export type ActualTimelineMode = 'actual' | 'compare';

export default function ActualTimelineHeader({ mode, totalLabel, onModeChange, onAdd }: {
  mode: ActualTimelineMode;
  totalLabel: string;
  onModeChange: (mode: ActualTimelineMode) => void;
  onAdd: () => void;
}) {
  return (
    <SectionCard className="!p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-text-tertiary)]">Actual timeline</p>
          <h2 className="mt-0.5 text-base font-black text-[var(--sf-text-primary)]">实际时间 · {totalLabel}</h2>
        </div>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-graphite)] px-3 py-2 text-[10px] font-black text-[var(--sf-bg)]">
          <Plus size={13} /> 补记
        </button>
      </div>
      <div className="mt-3 max-w-xs">
        <SegmentControl value={mode} onChange={onModeChange} ariaLabel="时间线显示模式" options={[
          { value: 'actual', label: '仅实际' },
          { value: 'compare', label: '计划对照' },
        ]} />
      </div>
    </SectionCard>
  );
}
