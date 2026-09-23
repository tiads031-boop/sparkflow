import type { TodayMetricValues } from './todayMetrics';
import { formatMetricDuration } from './todayMetrics';

export default function TodayMetrics({ values }: { values: TodayMetricValues }) {
  const metrics = [
    { label: '今日投入', value: formatMetricDuration(values.actualSeconds), tone: 'bg-[var(--sf-surface)]' },
    { label: '已完成', value: `${values.completedTasks}/${values.relevantTasks}`, tone: 'bg-[var(--sf-surface)]' },
    { label: '待进行', value: String(values.pendingItems), tone: 'bg-[var(--sf-surface)]' },
  ];

  return (
    <section className="grid grid-cols-3 gap-2" aria-label="今日概览">
      {metrics.map((metric) => (
        <div key={metric.label} className={`min-w-0 rounded-[18px] border border-[var(--sf-border)] ${metric.tone} px-2.5 py-2.5 shadow-[0_5px_16px_rgba(25,31,28,0.045)]`}>
          <strong className="block truncate text-[15px] font-black tracking-tight text-[var(--sf-text-primary)]">{metric.value}</strong>
          <span className="mt-0.5 block text-[9px] font-bold text-[var(--sf-text-secondary)]">{metric.label}</span>
        </div>
      ))}
    </section>
  );
}
