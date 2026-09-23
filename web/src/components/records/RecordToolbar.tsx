import { Sparkles } from 'lucide-react';

export type RecordPanel = 'scenes' | 'review' | 'insights' | null;

export default function RecordToolbar({ panel, pendingReviews, onPanelChange }: {
  panel: RecordPanel;
  pendingReviews: number;
  onPanelChange: (panel: RecordPanel) => void;
}) {
  return (
    <nav aria-label="记录分类" className="space-y-3">
      <div className="grid grid-cols-2 rounded-full border border-[var(--sf-border)] bg-[var(--sf-surface)] p-1 shadow-sm">
        <button type="button" aria-pressed={panel !== 'scenes'} onClick={() => onPanelChange(null)} className={`rounded-full py-2.5 text-xs font-bold transition ${panel !== 'scenes' ? 'bg-[var(--sf-graphite)] text-white' : 'text-[var(--sf-text-secondary)]'}`}>默认</button>
        <button type="button" aria-pressed={panel === 'scenes'} onClick={() => onPanelChange('scenes')} className={`rounded-full py-2.5 text-xs font-bold transition ${panel === 'scenes' ? 'bg-[var(--sf-graphite)] text-white' : 'text-[var(--sf-text-secondary)]'}`}>场景</button>
      </div>
      {panel !== 'scenes' && <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => onPanelChange(panel === 'review' ? null : 'review')} aria-pressed={panel === 'review'} className={`rounded-2xl border p-3 text-left ${panel === 'review' ? 'border-[#a9c778] bg-[#f2f9e7]' : 'border-[var(--sf-border)] bg-[var(--sf-surface)]'}`}><strong className="block text-xs">每日回顾</strong><span className="mt-1 block text-[11px] text-[var(--sf-text-secondary)]">{pendingReviews ? `今天还有 ${pendingReviews} 条` : '回看与整理'}</span></button>
        <button type="button" onClick={() => onPanelChange(panel === 'insights' ? null : 'insights')} aria-pressed={panel === 'insights'} className={`rounded-2xl border p-3 text-left ${panel === 'insights' ? 'border-[#a9c778] bg-[#f2f9e7]' : 'border-[var(--sf-border)] bg-[var(--sf-surface)]'}`}><strong className="flex items-center gap-1 text-xs">周期洞察 <Sparkles size={12} /></strong><span className="mt-1 block text-[11px] text-[var(--sf-text-secondary)]">回看变化与行动</span></button>
      </div>}
    </nav>
  );
}
