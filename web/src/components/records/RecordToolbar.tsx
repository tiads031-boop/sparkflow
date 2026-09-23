import { ChevronLeft, Sparkles } from 'lucide-react';

export type RecordPanel = 'scenes' | 'review' | 'insights' | null;

export default function RecordToolbar({ panel, pendingReviews, onPanelChange }: {
  panel: RecordPanel;
  pendingReviews: number;
  onPanelChange: (panel: RecordPanel) => void;
}) {
  if (panel === 'review' || panel === 'insights') return (
    <div className="flex items-center justify-between rounded-[20px] border border-[var(--sf-border)] bg-[var(--sf-surface)] px-3 py-2.5">
      <button type="button" onClick={() => onPanelChange(null)} className="flex items-center gap-1 rounded-full px-2 py-1.5 text-xs font-bold"><ChevronLeft size={14} /> 返回记录</button>
      <strong className="pr-2 text-xs">{panel === 'review' ? '每日回顾' : '周期洞察'}</strong>
    </div>
  );

  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1 rounded-[20px] border border-[var(--sf-border)] bg-[var(--sf-surface)] p-1 shadow-[0_7px_22px_rgba(30,40,30,.045)]" role="group" aria-label="记录分类">
      <button type="button" aria-pressed={!panel} onClick={() => onPanelChange(null)} className={`rounded-[15px] py-2.5 text-xs font-bold ${!panel ? 'bg-[var(--sf-graphite)] text-[var(--sf-green)]' : 'text-[var(--sf-text-secondary)]'}`}>默认记录</button>
      <button type="button" aria-pressed={panel === 'scenes'} onClick={() => onPanelChange('scenes')} className={`rounded-[15px] py-2.5 text-xs font-bold ${panel === 'scenes' ? 'bg-[var(--sf-graphite)] text-[var(--sf-green)]' : 'text-[var(--sf-text-secondary)]'}`}>场景</button>
    </div>
    {!panel && <div className="flex items-center gap-3 px-1 text-[11px] font-bold text-[var(--sf-text-secondary)]">
      <button type="button" onClick={() => onPanelChange('review')}>每日回顾{pendingReviews > 0 ? ` · ${pendingReviews}` : ''}</button>
      <span className="h-3 w-px bg-[var(--sf-border)]" />
      <button type="button" onClick={() => onPanelChange('insights')} className="flex items-center gap-1"><Sparkles size={12} /> 周期洞察</button>
    </div>}
  </div>;
}
