import { BadRequestException } from '@nestjs/common';
import type {
  ActualFact,
  AnalyticsBucket,
  AnalyticsDimension,
  PlanActualGroup,
  PlannedFact,
} from './analytics.types';

const MAX_RANGE_MS = 370 * 86_400_000;

export function parseAnalyticsRange(
  startValue: string,
  endValue: string,
  timeZone: string,
) {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (
    !startValue ||
    !endValue ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    throw new BadRequestException('start and end must be valid ISO dates');
  }
  if (end <= start) throw new BadRequestException('end must be after start');
  if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
    throw new BadRequestException('analytics range cannot exceed 370 days');
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(start);
  } catch {
    throw new BadRequestException('timeZone must be a valid IANA time zone');
  }
  return { start, end, timeZone };
}

export function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function mondayKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

export function bucketKey(
  date: Date,
  timeZone: string,
  bucket: AnalyticsBucket,
) {
  const day = localDateKey(date, timeZone);
  if (bucket === 'day') return day;
  if (bucket === 'week') return mondayKey(day);
  return day.slice(0, 7);
}

export function enumerateLocalDays(start: Date, end: Date, timeZone: string) {
  const first = new Date(`${localDateKey(start, timeZone)}T00:00:00.000Z`);
  const last = new Date(
    `${localDateKey(new Date(end.getTime() - 1), timeZone)}T00:00:00.000Z`,
  );
  const keys: string[] = [];
  for (
    const cursor = first;
    cursor <= last;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys;
}

export function overlapSeconds(
  start: Date,
  end: Date,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return Math.max(
    0,
    Math.round(
      (Math.min(end.getTime(), rangeEnd.getTime()) -
        Math.max(start.getTime(), rangeStart.getTime())) /
        1000,
    ),
  );
}

export function factGroup(
  fact: ActualFact | PlannedFact,
  groupBy: PlanActualGroup,
  timeZone: string,
) {
  if (groupBy === 'day') {
    const key = localDateKey(fact.start, timeZone);
    return { key, label: key };
  }
  if (groupBy === 'goal') {
    return fact.goal
      ? { key: fact.goal.id, label: fact.goal.label, color: fact.goal.color }
      : { key: 'unassigned', label: '未关联目标' };
  }
  const label = fact.tags[0];
  return label ? { key: label, label } : { key: 'untagged', label: '未标记' };
}

export function dimensionParts(
  fact: ActualFact,
  dimension: AnalyticsDimension,
): Array<{ key: string; label: string; color?: string }> {
  if (dimension === 'source') {
    return [
      {
        key: fact.source,
        label: fact.source === 'focus' ? 'Focus' : '手工补记',
      },
    ];
  }
  if (dimension === 'goal') {
    return fact.goal
      ? [{ key: fact.goal.id, label: fact.goal.label, color: fact.goal.color }]
      : [{ key: 'unassigned', label: '未关联目标' }];
  }
  if (dimension === 'scene')
    return [{ key: 'unassigned', label: '未关联场景' }];
  return fact.tags.length
    ? fact.tags.map((tag) => ({ key: tag, label: tag }))
    : [{ key: 'untagged', label: '未标记' }];
}
