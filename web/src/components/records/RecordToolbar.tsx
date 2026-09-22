import { ChevronLeft, LayoutGrid, List, Sparkles } from 'lucide-react';

export type RecordViewMode = 'cards' | 'wall';
export type RecordPanel = 'scenes' | 'review' | 'insights' | null;

export default function RecordToolbar({ mode, panel, pendingReviews, onModeChange, onPanelChange }: {
  mode: RecordViewMode;
  panel: RecordPanel;
  pendingReviews: number;
  onModeChange: (mode: RecordViewMode) => void;
  onPanelChange: (panel: RecordPanel) => void;
}) {
  if (panel) {
    return (
      <div className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-3 py-2 shadow-sm">
        <button type="button" onClick={() => onPanelChange(null)} className="flex items-center gap-1 rounded-full bg-[var(--sf-bg)] px-3 py-2 text-[11px] font-bold"><ChevronLeft size={13} /> 返回记录</button>
        <strong className="text-xs text-[var(--sf-text-primary)]">{panel === 'review' ? '每日回顾' : panel === 'scenes' ? '场景' : '周期洞察'}</strong>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 rounded-full bg-[var(--sf-surface)] p-1 shadow-sm" role="group" aria-label="记录视图">
        <button type="button" aria-pressed={mode === 'cards'} onClick={() => onModeChange('cards')} className={`flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold ${mode === 'cards' ? 'bg-[var(--sf-graphite)] text-white' : 'text-[var(--sf-text-secondary)]'}`}><List size={12} /> 卡片</button>
        <button type="button" aria-pressed={mode === 'wall'} onClick={() => onModeChange('wall')} className={`flex items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold ${mode === 'wall' ? 'bg-[var(--sf-graphite)] text-white' : 'text-[var(--sf-text-secondary)]'}`}><LayoutGrid size={12} /> 自由墙</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => onPanelChange('scenes')} className="rounded-2xl bg-[var(--sf-surface)] px-3 py-3 text-left shadow-sm"><strong className="block text-xs">场景</strong><span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">记录模板</span></button>
        <button type="button" onClick={() => onPanelChange('review')} className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-4 py-3 text-left shadow-sm"><span><strong className="block text-xs">每日回顾</strong><span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">固定抽取 · 跨端同步</span></span>{pendingReviews > 0 ? <span className="rounded-full bg-[#cae393] px-2 py-1 text-[10px] font-black text-[#242424]">{pendingReviews}</span> : null}</button>
        <button type="button" onClick={() => onPanelChange('insights')} className="flex items-center justify-between rounded-2xl bg-[var(--sf-surface)] px-4 py-3 text-left shadow-sm"><span><strong className="block text-xs">周期洞察</strong><span className="mt-0.5 block text-[10px] text-[var(--sf-text-tertiary)]">回看变化与行动</span></span><Sparkles size={14} className="text-[var(--sf-marker-purple)]" /></button>
      </div>
    </div>
  );
}
