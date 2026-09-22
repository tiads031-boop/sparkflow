import type { TimeAnalyticsResponse } from '../../api/analytics';
import { formatAnalyticsDuration } from './analyticsPresentation';

export default function TimeDistributionBars({
  breakdown,
  totalSeconds,
}: {
  breakdown: TimeAnalyticsResponse['breakdown'];
  totalSeconds: number;
}) {
  if (breakdown.length === 0) {
    return <p className="py-6 text-center text-xs text-[var(--sf-text-tertiary)]">当前范围还没有可分布的实际投入。</p>;
  }

  return (
    <div className="space-y-3">
      {breakdown.slice(0, 6).map((item) => {
        const percent = totalSeconds > 0 ? Math.round((item.actualSeconds / totalSeconds) * 100) : 0;
        return (
          <div key={item.key}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-[10px]">
              <span className="min-w-0 truncate font-bold text-[var(--sf-text-secondary)]">#{item.label}</span>
              <span className="shrink-0 text-[var(--sf-text-tertiary)]">{formatAnalyticsDuration(item.actualSeconds)} · {percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--sf-bg)]">
              <div
                className="h-full min-w-1 rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.max(2, percent)}%`,
                  backgroundColor: item.color || 'var(--sf-green-strong)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
