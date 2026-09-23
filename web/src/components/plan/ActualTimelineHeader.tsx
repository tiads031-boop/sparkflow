import { Plus } from 'lucide-react';
import { SegmentControl } from '../ui/foundation';

export type ActualTimelineMode = 'actual' | 'compare';

export default function ActualTimelineHeader({ mode, totalLabel, onModeChange, onAdd, manualBackfillEnabled }: {
  mode: ActualTimelineMode;
  totalLabel: string;
  onModeChange: (mode: ActualTimelineMode) => void;
  onAdd: () => void;
  manualBackfillEnabled: boolean;
}) {
  return (
    <header className="space-y-3 px-1 pb-1">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[25px] font-black tracking-tight text-[var(--sf-text-primary)]">Actual Timeline</h2>
          <p className="text-[10px] text-[var(--sf-text-secondary)]">真实发生的时间，而不是截止日期</p>
        </div>
        {manualBackfillEnabled ? <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 rounded-full bg-[var(--sf-graphite)] px-3 py-2 text-[10px] font-black text-[var(--sf-bg)]">
          <Plus size={13} /> 补记
        </button> : null}
      </div>
      <div className="max-w-[220px]">
        <SegmentControl value={mode} onChange={onModeChange} ariaLabel="时间线显示模式" options={[
          { value: 'actual', label: '仅实际' },
          { value: 'compare', label: '计划对照' },
        ]} />
      </div>
      <div className="flex items-center justify-between rounded-[14px] bg-[var(--sf-surface)] px-3 py-2 text-[10px] font-bold text-[var(--sf-text-secondary)]"><span>当天实际投入</span><strong className="text-sm text-[var(--sf-text-primary)]">{totalLabel}</strong></div>
    </header>
  );
}
