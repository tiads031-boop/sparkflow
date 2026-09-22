import type { HeatmapResponse } from '../../api/analytics';
import { formatAnalyticsDuration } from './analyticsPresentation';

const levelClasses = [
  'bg-[var(--sf-bg)]',
  'bg-[#edf6dc]',
  'bg-[#dff1b9]',
  'bg-[#cfe99c]',
  'bg-[var(--sf-green-strong)]',
];

export default function ExecutionHeatmap({ days }: { days: HeatmapResponse['days'] }) {
  if (days.length === 0) {
    return <p className="py-6 text-center text-xs text-[var(--sf-text-tertiary)]">当前范围暂无热力数据。</p>;
  }
  const firstWeekday = (new Date(`${days[0].date}T00:00:00.000Z`).getUTCDay() + 6) % 7;
  const padding = Array.from({ length: firstWeekday }, (_, index) => `padding-${index}`);

  return (
    <div>
      <div className="mb-2 flex justify-between text-[9px] text-[var(--sf-text-tertiary)]">
        <span>{days[0].date.slice(5).replace('-', '/')}</span>
        <span>{days.at(-1)?.date.slice(5).replace('-', '/')}</span>
      </div>
      <div className="grid auto-cols-[12px] grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1" aria-label="实际投入热力图">
        {padding.map((key) => <span key={key} className="h-3 w-3" aria-hidden="true" />)}
        {days.map((day) => (
          <span
            key={day.date}
            className={`h-3 w-3 rounded-[3px] ${levelClasses[Math.min(4, Math.max(0, day.level))]}`}
            aria-label={`${day.date}，${formatAnalyticsDuration(day.actualSeconds)}，${day.count} 条记录`}
            role="img"
            title={`${day.date} · ${formatAnalyticsDuration(day.actualSeconds)}`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[9px] text-[var(--sf-text-tertiary)]">
        <span>少</span>
        {levelClasses.map((className, index) => <span key={className} className={`h-2.5 w-2.5 rounded-[3px] ${className}`} aria-label={`热力等级 ${index}`} />)}
        <span>多</span>
      </div>
    </div>
  );
}
