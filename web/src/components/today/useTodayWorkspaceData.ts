import { useEffect, useMemo, useState } from 'react';
import { getActualTimeline, type ActualTimelineEntry } from '../../api/actualTimeline';
import { listInspirationsForDay, type InspirationRecord } from '../../api/inspirations';
import type { PlannerPreview, Task } from '../../types';
import { usePlanItems } from '../plan/usePlanItems';
import {
  addLocalDays,
  buildPlannerPreviewItems,
  itemsForLocalDay,
  localDateKey,
  startOfLocalDay,
} from '../plan/planProjection';
import { calculateTodayMetrics } from './todayMetrics';

export function useTodayWorkspaceData(
  date: Date,
  tasks: Task[],
  plannerPreview?: PlannerPreview | null,
) {
  const plan = usePlanItems(date, 'agenda');
  const [actualEntries, setActualEntries] = useState<ActualTimelineEntry[]>([]);
  const [records, setRecords] = useState<InspirationRecord[]>([]);
  const [actualError, setActualError] = useState<string | null>(null);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [recordsLoadedKey, setRecordsLoadedKey] = useState('');
  const [actualRevision, setActualRevision] = useState(0);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const dateKey = localDateKey(date);
  const requestKey = `${dateKey}:${actualRevision}`;
  const recordsRequestKey = `${dateKey}:${recordsRevision}`;

  useEffect(() => {
    const refresh = () => setActualRevision((value) => value + 1);
    window.addEventListener('sparkflow:actual-changed', refresh);
    return () => window.removeEventListener('sparkflow:actual-changed', refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setRecordsRevision((value) => value + 1);
    window.addEventListener('sparkflow:records-changed', refresh);
    return () => window.removeEventListener('sparkflow:records-changed', refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const start = startOfLocalDay(date);
    const end = addLocalDays(start, 1);
    void getActualTimeline(start.toISOString(), end.toISOString(), controller.signal)
      .then((entries) => {
        setActualEntries(entries || []);
        setActualError(null);
        setLoadedKey(requestKey);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setActualEntries([]);
        setActualError(error instanceof Error ? error.message : '加载实际时间失败');
        setLoadedKey(requestKey);
      });
    return () => controller.abort();
  }, [date, requestKey]);

  useEffect(() => {
    const controller = new AbortController();
    const start = startOfLocalDay(date);
    const end = addLocalDays(start, 1);
    void listInspirationsForDay(start.toISOString(), end.toISOString(), controller.signal)
      .then((items) => {
        setRecords(items || []);
        setRecordsError(null);
        setRecordsLoadedKey(recordsRequestKey);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setRecords([]);
        setRecordsError(error instanceof Error ? error.message : '加载今日记录失败');
        setRecordsLoadedKey(recordsRequestKey);
      });
    return () => controller.abort();
  }, [date, recordsRequestKey]);

  const plannedItems = useMemo(
    () => itemsForLocalDay(plan.items, date),
    [date, plan.items],
  );
  const previewItems = useMemo(
    () => itemsForLocalDay(buildPlannerPreviewItems(plannerPreview, tasks), date),
    [date, plannerPreview, tasks],
  );
  const metrics = useMemo(
    () => calculateTodayMetrics(date, tasks, plannedItems, actualEntries),
    [actualEntries, date, plannedItems, tasks],
  );

  return {
    plannedItems,
    previewItems,
    actualEntries,
    records,
    metrics,
    loading: plan.loading || loadedKey !== requestKey || recordsLoadedKey !== recordsRequestKey,
    error: plan.error || actualError || recordsError,
  };
}
