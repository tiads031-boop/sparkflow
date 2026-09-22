import type { PlanActualResponse } from '../../api/analytics';
import { formatAnalyticsDuration } from './analyticsPresentation';

export default function PlanActualCompare({ data }: { data: PlanActualResponse }) {
  const maximum = Math.max(1, data.plannedSeconds, data.actualSeconds);
  const rows = [
    { label: '计划', seconds: data.plannedSeconds, color: 'bg-[var(--sf-blue)]' },
    { label: '实际', seconds: data.actualSeconds, color: 'bg-[var(--sf-green-strong)]' },
  ];

  return (
    <div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[34px_1fr_auto] items-center gap-2">
            <span className="text-[10px] font-bold text-[var(--sf-text-secondary)]">{row.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--sf-bg)]">
              <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.max(2, (row.seconds / maximum) * 100)}%` }} />
            </div>
            <strong className="min-w-16 text-right text-[10px] text-[var(--sf-text-primary)]">{formatAnalyticsDuration(row.seconds)}</strong>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[var(--sf-bg)] px-3 py-3">
          <span className="block text-[9px] text-[var(--sf-text-tertiary)]">匹配计划</span>
          <strong className="mt-1 block text-sm text-[var(--sf-text-primary)]">{formatAnalyticsDuration(data.matchedActualSeconds)}</strong>
        </div>
        <div className="rounded-2xl bg-[var(--sf-bg)] px-3 py-3">
          <span className="block text-[9px] text-[var(--sf-text-tertiary)]">计划外投入</span>
          <strong className="mt-1 block text-sm text-[var(--sf-text-primary)]">{formatAnalyticsDuration(data.unplannedActualSeconds)}</strong>
        </div>
      </div>
    </div>
  );
}
