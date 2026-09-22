import { api } from './client';

export type AnalyticsPeriod = 'week' | 'month' | 'quarter';

export interface TimeAnalyticsResponse {
  range: { start: string; end: string; timeZone: string };
  totalActualSeconds: number;
  previousTotalActualSeconds: number;
  buckets: Array<{
    key: string;
    start: string;
    end: string;
    actualSeconds: number;
    sessionCount: number;
  }>;
  breakdown: Array<{
    key: string;
    label: string;
    actualSeconds: number;
    sessionCount: number;
    color?: string;
  }>;
}

export interface PlanActualResponse {
  plannedSeconds: number;
  actualSeconds: number;
  deltaSeconds: number;
  matchedActualSeconds: number;
  unplannedActualSeconds: number;
  groups: Array<{
    key: string;
    label: string;
    plannedSeconds: number;
    actualSeconds: number;
    deltaSeconds: number;
    color?: string;
  }>;
  matches: Array<{
    actualId: string;
    plannedId?: string;
    relation: 'on_time' | 'early' | 'late' | 'longer' | 'shorter' | 'unplanned';
    confidence: 'exact' | 'strong' | 'inferred' | 'none';
    startDeltaMinutes?: number;
    durationDeltaMinutes?: number;
  }>;
}

export interface HeatmapResponse {
  days: Array<{
    date: string;
    actualSeconds: number;
    count: number;
    level: number;
  }>;
  maxActualSeconds: number;
}

export interface AnalyticsQuery {
  start: string;
  end: string;
  timeZone: string;
}

function queryString(query: AnalyticsQuery, extra: Record<string, string>) {
  return new URLSearchParams({ ...query, ...extra }).toString();
}

export function getTimeAnalytics(query: AnalyticsQuery, signal?: AbortSignal) {
  return api.get<TimeAnalyticsResponse>(
    `/analytics/time?${queryString(query, { bucket: 'day', dimension: 'tag' })}`,
    { signal, throwOnError: true },
  );
}

export function getPlanActualAnalytics(query: AnalyticsQuery, signal?: AbortSignal) {
  return api.get<PlanActualResponse>(
    `/analytics/plan-actual?${queryString(query, { groupBy: 'day' })}`,
    { signal, throwOnError: true },
  );
}

export function getExecutionHeatmap(query: AnalyticsQuery, signal?: AbortSignal) {
  return api.get<HeatmapResponse>(
    `/analytics/heatmap?${queryString(query, { filterType: 'all' })}`,
    { signal, throwOnError: true },
  );
}
