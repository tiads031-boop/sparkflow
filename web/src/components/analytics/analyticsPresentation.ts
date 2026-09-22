import type { AnalyticsPeriod, AnalyticsQuery } from '../../api/analytics';

export function formatAnalyticsDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} 分钟`;
  if (minutes === 0) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分`;
}

export function analyticsTrend(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? { direction: 'new' as const, percent: null } : { direction: 'flat' as const, percent: 0 };
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    direction: percent > 0 ? 'up' as const : percent < 0 ? 'down' as const : 'flat' as const,
    percent: Math.abs(percent),
  };
}

export function analyticsRange(anchor: Date, period: AnalyticsPeriod): AnalyticsQuery {
  const end = new Date(anchor);
  end.setHours(24, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - (period === 'week' ? 7 : period === 'month' ? 30 : 84));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  };
}
