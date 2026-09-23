import { useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import {
  getExecutionHeatmap,
  getPlanActualAnalytics,
  getTimeAnalytics,
  type AnalyticsPeriod,
  type HeatmapResponse,
  type PlanActualResponse,
  type TimeAnalyticsResponse,
} from '../../api/analytics';
import { EmptyState, PageHeader, SectionCard, SegmentControl } from '../ui/foundation';
import ExecutionHeatmap from './ExecutionHeatmap';
import PlanActualCompare from './PlanActualCompare';
import TimeDistributionBars from './TimeDistributionBars';
import { analyticsRange, analyticsTrend, formatAnalyticsDuration } from './analyticsPresentation';

interface AnalyticsResult {
  key: string;
  time?: TimeAnalyticsResponse;
  planActual?: PlanActualResponse;
  heatmap?: HeatmapResponse;
  error?: string;
}

const periodOptions: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 'week', label: '7 天' },
  { value: 'month', label: '30 天' },
  { value: 'quarter', label: '12 周' },
];

function DailyRhythm({ buckets }: { buckets: TimeAnalyticsResponse['buckets'] }) {
  if (buckets.length === 0) return null;
  const maximum = Math.max(1, ...buckets.map((bucket) => bucket.actualSeconds));
  return (
    <div className="mt-5 flex h-16 items-end gap-1" aria-label="每日实际投入趋势">
      {buckets.map((bucket) => (
        <span
          key={bucket.key}
          className="min-w-1 flex-1 rounded-t-md bg-[var(--sf-green-strong)] opacity-90"
          style={{ height: `${Math.max(6, (bucket.actualSeconds / maximum) * 100)}%` }}
          aria-label={`${bucket.key}，${formatAnalyticsDuration(bucket.actualSeconds)}`}
          role="img"
          title={`${bucket.key} · ${formatAnalyticsDuration(bucket.actualSeconds)}`}
        />
      ))}
    </div>
  );
}

export default function TimeAnalyticsView({
  onBack,
  onOpenActual,
}: {
  onBack: () => void;
  onOpenActual: () => void;
}) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [anchor] = useState(() => new Date());
  const [retry, setRetry] = useState(0);
  const query = useMemo(() => analyticsRange(anchor, period), [anchor, period]);
  const queryKey = `${query.start}:${query.end}:${query.timeZone}:${retry}`;
  const [result, setResult] = useState<AnalyticsResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getTimeAnalytics(query, controller.signal),
      getPlanActualAnalytics(query, controller.signal),
      getExecutionHeatmap(query, controller.signal),
    ]).then(([time, planActual, heatmap]) => {
      setResult({ key: queryKey, time, planActual, heatmap });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setResult({
        key: queryKey,
        error: error instanceof Error ? error.message : '加载时间分析失败',
      });
    });
    return () => controller.abort();
  }, [query, queryKey]);

  const current = result?.key === queryKey ? result : null;
  const loading = current === null;
  const trend = current?.time
    ? analyticsTrend(current.time.totalActualSeconds, current.time.previousTotalActualSeconds)
    : null;
  const hasActual = Boolean(current?.time?.totalActualSeconds);

  return (
    <div className="min-h-full animate-page-enter px-4 pb-24">
      <PageHeader
        title="分析"
        subtitle="只展示可解释的执行数据"
        onBack={onBack}
        action={(
          <button type="button" onClick={onOpenActual} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sf-surface)] shadow-sm" aria-label="打开实际时间线">
            <Clock3 size={16} />
          </button>
        )}
      />

      <SegmentControl value={period} options={periodOptions} onChange={setPeriod} ariaLabel="分析时间范围" />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-xs font-bold text-[var(--sf-text-tertiary)]">
          <Loader2 size={15} className="animate-spin" /> 正在计算真实投入…
        </div>
      ) : current.error ? (
        <div className="mt-4 rounded-[1.65rem] border border-red-100 bg-red-50 px-5 py-6 text-center">
          <p className="text-xs leading-5 text-red-700">{current.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-red-700">
            <RefreshCw size={13} /> 重试
          </button>
        </div>
      ) : current.time && current.planActual && current.heatmap ? (
        <div className="mt-4 space-y-4">
          <section className="overflow-hidden rounded-[1.8rem] bg-[var(--sf-graphite)] px-5 py-5 text-[var(--sf-bg)] shadow-[0_18px_44px_rgba(18,18,22,0.16)]">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--sf-green)]">Actual investment</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <strong className="text-[30px] font-black tracking-[-0.05em]">{formatAnalyticsDuration(current.time.totalActualSeconds)}</strong>
              {trend ? (
                <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--sf-green)]">
                  {trend.direction === 'up' ? <TrendingUp size={13} /> : trend.direction === 'down' ? <TrendingDown size={13} /> : null}
                  {trend.direction === 'new' ? '本期新增' : trend.direction === 'flat' ? '与上期持平' : `${trend.percent}%`}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-white/55">{current.time.buckets.reduce((sum, bucket) => sum + bucket.sessionCount, 0)} 次有效记录</p>
            <DailyRhythm buckets={current.time.buckets} />
          </section>

          {!hasActual ? (
            <EmptyState title="还没有实际投入记录" description="完成一次 Focus，或在 Actual Timeline 手工补记时间后，这里会生成真实分析。" />
          ) : null}

          <SectionCard>
            <div className="mb-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Distribution</p>
              <h2 className="mt-1 text-sm font-black text-[var(--sf-text-primary)]">标签分布</h2>
            </div>
            <TimeDistributionBars breakdown={current.time.breakdown} totalSeconds={current.time.totalActualSeconds} />
          </SectionCard>

          {current.time.appUsage && <SectionCard>
            <h2 className="text-sm font-black">Android 应用使用 · 单独统计</h2>
            <p className="mt-1 text-xs text-[var(--sf-text-secondary)]">{formatAnalyticsDuration(current.time.appUsage.totalSeconds)} · {current.time.appUsage.sessionCount} 段；与 Focus 可能重叠，不加入主动投入或计划偏差。</p>
            {current.time.appUsage.byTag.slice(0, 5).map((item) => <p key={item.name} className="mt-2 flex justify-between text-xs"><span>{item.name}</span><span>{formatAnalyticsDuration(item.seconds)}</span></p>)}
            {current.time.appUsage.truncated && <p className="mt-2 text-xs text-amber-700">记录过多，此范围仅显示最近 10000 段。</p>}
          </SectionCard>}

          <SectionCard>
            <div className="mb-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Plan vs actual</p>
              <h2 className="mt-1 text-sm font-black text-[var(--sf-text-primary)]">计划与实际</h2>
            </div>
            <PlanActualCompare data={current.planActual} />
          </SectionCard>

          <SectionCard>
            <div className="mb-4">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--sf-text-tertiary)]">Consistency</p>
              <h2 className="mt-1 text-sm font-black text-[var(--sf-text-primary)]">投入热力</h2>
            </div>
            <ExecutionHeatmap days={current.heatmap.days} />
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
