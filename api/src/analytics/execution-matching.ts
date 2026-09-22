import type {
  ActualFact,
  AnalyticsMatch,
  MatchConfidence,
  PlannedFact,
} from './analytics.types';

export const START_TOLERANCE_MINUTES = 5;
export const DURATION_TOLERANCE_RATIO = 0.1;
export const INFERRED_NEARBY_MINUTES = 60;

function normalizeTitle(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[\s·・—_\-:：，,。.!！?？()（）]/g, '');
}

function overlapMilliseconds(actual: ActualFact, planned: PlannedFact) {
  return Math.max(
    0,
    Math.min(actual.end.getTime(), planned.end.getTime()) -
      Math.max(actual.start.getTime(), planned.start.getTime()),
  );
}

function nearestByStart(actual: ActualFact, candidates: PlannedFact[]) {
  let nearest: PlannedFact | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const distance = Math.abs(
      candidate.start.getTime() - actual.start.getTime(),
    );
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function describeMatch(
  actual: ActualFact,
  planned: PlannedFact,
  confidence: MatchConfidence,
): AnalyticsMatch {
  const plannedDurationMinutes = Math.max(
    1,
    (planned.end.getTime() - planned.start.getTime()) / 60_000,
  );
  const actualDurationMinutes = actual.effectiveDurationSeconds / 60;
  const startDeltaMinutes = Math.round(
    (actual.start.getTime() - planned.start.getTime()) / 60_000,
  );
  const durationDeltaMinutes = Math.round(
    actualDurationMinutes - plannedDurationMinutes,
  );

  let relation: AnalyticsMatch['relation'] = 'on_time';
  if (
    confidence !== 'inferred' &&
    Math.abs(startDeltaMinutes) > START_TOLERANCE_MINUTES
  ) {
    relation = startDeltaMinutes > 0 ? 'late' : 'early';
  } else if (
    confidence !== 'inferred' &&
    Math.abs(durationDeltaMinutes) >
      plannedDurationMinutes * DURATION_TOLERANCE_RATIO
  ) {
    relation = durationDeltaMinutes > 0 ? 'longer' : 'shorter';
  }

  return {
    actualId: actual.id,
    plannedId: planned.id,
    relation,
    confidence,
    startDeltaMinutes,
    durationDeltaMinutes,
    plannedStart: planned.start.toISOString(),
  };
}

export function matchActualToPlanned(
  actual: ActualFact,
  planned: PlannedFact[],
): AnalyticsMatch {
  const exact = nearestByStart(
    actual,
    planned.filter((item) =>
      Boolean(actual.taskId && item.taskId === actual.taskId),
    ),
  );
  if (exact) return describeMatch(actual, exact, 'exact');

  const actualTitle = normalizeTitle(actual.title);
  const strong = nearestByStart(
    actual,
    planned.filter(
      (item) =>
        normalizeTitle(item.title) === actualTitle &&
        overlapMilliseconds(actual, item) > 0,
    ),
  );
  if (strong) return describeMatch(actual, strong, 'strong');

  const inferred = nearestByStart(
    actual,
    planned.filter((item) => {
      const plannedTitle = normalizeTitle(item.title);
      const titleRelated =
        actualTitle.length >= 2 &&
        plannedTitle.length >= 2 &&
        (actualTitle.includes(plannedTitle) ||
          plannedTitle.includes(actualTitle));
      const nearbyMinutes =
        Math.abs(item.start.getTime() - actual.start.getTime()) / 60_000;
      return titleRelated && nearbyMinutes <= INFERRED_NEARBY_MINUTES;
    }),
  );
  if (inferred) return describeMatch(actual, inferred, 'inferred');

  return {
    actualId: actual.id,
    relation: 'unplanned',
    confidence: 'none',
  };
}
