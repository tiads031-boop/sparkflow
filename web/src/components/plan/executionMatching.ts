import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { PlanItem } from './planProjection';

export const START_TOLERANCE_MINUTES = 5;
export const DURATION_TOLERANCE_RATIO = 0.1;
export const INFERRED_NEARBY_MINUTES = 60;
export const ACTUAL_GAP_THRESHOLD_MINUTES = 15;

export type MatchConfidence = 'exact' | 'strong' | 'inferred' | 'none';
export type ExecutionRelation = 'on_time' | 'early' | 'late' | 'longer' | 'shorter' | 'unplanned';

export interface ExecutionMatch {
  planned: PlanItem | null;
  confidence: MatchConfidence;
  relation: ExecutionRelation;
  label: string;
  startDeltaMinutes: number | null;
  durationDeltaMinutes: number | null;
}

function normalizeTitle(value: string) {
  return value.toLocaleLowerCase().replace(/[\s·・—_\-:：，,。.!！?？()（）]/g, '');
}

function overlapMilliseconds(actual: ActualTimelineEntry, planned: PlanItem) {
  return Math.max(0, Math.min(new Date(actual.end).getTime(), new Date(planned.end).getTime())
    - Math.max(new Date(actual.start).getTime(), new Date(planned.start).getTime()));
}

function nearestByStart(actual: ActualTimelineEntry, candidates: PlanItem[]) {
  return [...candidates].sort((left, right) => (
    Math.abs(new Date(left.start).getTime() - new Date(actual.start).getTime())
    - Math.abs(new Date(right.start).getTime() - new Date(actual.start).getTime())
  ))[0] ?? null;
}

function relationFor(actual: ActualTimelineEntry, planned: PlanItem, confidence: MatchConfidence): ExecutionMatch {
  const plannedDurationMinutes = Math.max(1, (new Date(planned.end).getTime() - new Date(planned.start).getTime()) / 60_000);
  const actualDurationMinutes = actual.effectiveDurationSeconds / 60;
  const startDeltaMinutes = Math.round((new Date(actual.start).getTime() - new Date(planned.start).getTime()) / 60_000);
  const durationDeltaMinutes = Math.round(actualDurationMinutes - plannedDurationMinutes);

  if (confidence === 'inferred') {
    return { planned, confidence, relation: 'on_time', label: '推测匹配', startDeltaMinutes, durationDeltaMinutes };
  }
  if (Math.abs(startDeltaMinutes) > START_TOLERANCE_MINUTES) {
    const relation = startDeltaMinutes > 0 ? 'late' : 'early';
    return {
      planned,
      confidence,
      relation,
      label: `${startDeltaMinutes > 0 ? '晚' : '早'} ${Math.abs(startDeltaMinutes)} 分钟`,
      startDeltaMinutes,
      durationDeltaMinutes,
    };
  }
  if (Math.abs(durationDeltaMinutes) > plannedDurationMinutes * DURATION_TOLERANCE_RATIO) {
    const relation = durationDeltaMinutes > 0 ? 'longer' : 'shorter';
    return {
      planned,
      confidence,
      relation,
      label: `${durationDeltaMinutes > 0 ? '多投入' : '少'} ${Math.abs(durationDeltaMinutes)} 分钟`,
      startDeltaMinutes,
      durationDeltaMinutes,
    };
  }
  return { planned, confidence, relation: 'on_time', label: '与计划一致', startDeltaMinutes, durationDeltaMinutes };
}

export function matchActualToPlan(actual: ActualTimelineEntry, plannedItems: PlanItem[]): ExecutionMatch {
  const planned = plannedItems.filter((item) => !item.preview && item.kind !== 'focus');
  const exact = nearestByStart(actual, planned.filter((item) => Boolean(actual.taskId && item.taskId === actual.taskId)));
  if (exact) return relationFor(actual, exact, 'exact');

  const actualTitle = normalizeTitle(actual.title);
  const strong = nearestByStart(actual, planned.filter((item) => (
    normalizeTitle(item.title) === actualTitle && overlapMilliseconds(actual, item) > 0
  )));
  if (strong) return relationFor(actual, strong, 'strong');

  const inferred = nearestByStart(actual, planned.filter((item) => {
    const plannedTitle = normalizeTitle(item.title);
    const titleRelated = actualTitle.length >= 2 && plannedTitle.length >= 2
      && (actualTitle.includes(plannedTitle) || plannedTitle.includes(actualTitle));
    const nearbyMinutes = Math.abs(new Date(item.start).getTime() - new Date(actual.start).getTime()) / 60_000;
    return titleRelated && nearbyMinutes <= INFERRED_NEARBY_MINUTES;
  }));
  if (inferred) return relationFor(actual, inferred, 'inferred');

  return {
    planned: null,
    confidence: 'none',
    relation: 'unplanned',
    label: '未计划',
    startDeltaMinutes: null,
    durationDeltaMinutes: null,
  };
}

export interface ActualTimelineGapValue {
  id: string;
  start: string;
  end: string;
  minutes: number;
}

export function findActualTimelineGaps(entries: ActualTimelineEntry[], thresholdMinutes = ACTUAL_GAP_THRESHOLD_MINUTES) {
  const sorted = [...entries].sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime());
  const gaps: ActualTimelineGapValue[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const start = new Date(sorted[index - 1].end);
    const end = new Date(sorted[index].start);
    const minutes = Math.floor((end.getTime() - start.getTime()) / 60_000);
    if (minutes > thresholdMinutes) {
      gaps.push({ id: `${sorted[index - 1].id}:${sorted[index].id}`, start: start.toISOString(), end: end.toISOString(), minutes });
    }
  }
  return gaps;
}
