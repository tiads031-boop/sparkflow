import type { TodayMetricValues } from './todayMetrics';
import { formatMetricDuration } from './todayMetrics';

export default function TodayMetrics({ values }: { values: TodayMetricValues }) {
  const metrics = [
    { label: '今日投入', value: formatMetricDuration(values.actualSeconds), tone: 'bg-[var(--sf-green)]' },
    { label: '已完成', value: `${values.completedTasks}/${values.relevantTasks}`, tone: 'bg-[var(--sf-purple-soft)]' },
    { label: '待进行', value: String(values.pendingItems), tone: 'bg-[var(--sf-blue)]' },
  ];

  return (
    <section className="grid grid-cols-3 gap-2" aria-label="今日概览">
      {metrics.map((metric) => (
        <div key={metric.label} className={`rounded-[22px] ${metric.tone} px-3 py-3.5`}>
          <span className="block text-[9px] font-extrabold text-[#465049]">{metric.label}</span>
          <strong className="mt-1 block text-lg font-black tracking-tight text-[#202322]">{metric.value}</strong>
        </div>
      ))}
    </section>
  );
}
