import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  bucketKey,
  dimensionParts,
  enumerateLocalDays,
  factGroup,
  localDateKey,
  overlapSeconds,
  parseAnalyticsRange,
} from './analytics-time';
import { matchActualToPlanned } from './execution-matching';
import { projectPlannedFacts } from './planned-projection';
import type {
  ActualFact,
  AnalyticsBucket,
  AnalyticsDimension,
  PlanActualGroup,
} from './analytics.types';

const buckets: AnalyticsBucket[] = ['day', 'week', 'month'];
const dimensions: AnalyticsDimension[] = ['tag', 'goal', 'scene', 'source'];
const planGroups: PlanActualGroup[] = ['day', 'tag', 'goal'];

function requireOption<T extends string>(
  value: string,
  options: T[],
  label: string,
): T {
  if (!options.includes(value as T)) {
    throw new BadRequestException(
      `${label} must be one of: ${options.join(', ')}`,
    );
  }
  return value as T;
}

function bucketEnd(key: string, bucket: AnalyticsBucket) {
  if (bucket === 'month') {
    const [year, month] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
  }
  const end = new Date(`${key}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + (bucket === 'week' ? 7 : 1));
  return end.toISOString().slice(0, 10);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadActualFacts(
    userId: string,
    start: Date,
    end: Date,
  ): Promise<ActualFact[]> {
    const sessions = await this.prisma.pomodoroSession.findMany({
      where: {
        userId,
        countsTowardActual: true,
        status: { in: ['completed', 'interrupted'] },
        effectiveDurationSeconds: { gt: 0 },
        startedAt: { lt: end },
        endedAt: { gt: start },
      },
      orderBy: { startedAt: 'asc' },
      select: {
        id: true,
        taskId: true,
        title: true,
        entrySource: true,
        tags: true,
        startedAt: true,
        endedAt: true,
        effectiveDurationSeconds: true,
        segments: { select: { startedAt: true, endedAt: true } },
        task: {
          select: {
            title: true,
            tags: true,
            project: true,
            studyFolders: {
              take: 1,
              select: {
                folder: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
      },
    });

    return sessions.flatMap((session) => {
      if (!session.endedAt) return [];
      const segmentSeconds = session.segments.reduce((sum, segment) => {
        const segmentEnd = segment.endedAt ?? session.endedAt!;
        return sum + overlapSeconds(segment.startedAt, segmentEnd, start, end);
      }, 0);
      const fallbackSeconds = overlapSeconds(
        session.startedAt,
        session.endedAt,
        start,
        end,
      );
      const effectiveDurationSeconds = Math.min(
        session.effectiveDurationSeconds,
        segmentSeconds || fallbackSeconds,
      );
      if (effectiveDurationSeconds <= 0) return [];
      const folder = session.task?.studyFolders[0]?.folder;
      const project = session.task?.project;
      return [
        {
          id: session.id,
          taskId: session.taskId,
          title:
            session.title?.trim() ||
            session.task?.title ||
            (session.entrySource === 'manual' ? '手工时间记录' : '自由专注'),
          start: session.startedAt < start ? start : session.startedAt,
          end: session.endedAt > end ? end : session.endedAt,
          effectiveDurationSeconds,
          source:
            session.entrySource === 'manual'
              ? ('manual' as const)
              : ('focus' as const),
          tags: session.tags.length ? session.tags : (session.task?.tags ?? []),
          goal: folder
            ? { id: folder.id, label: folder.name, color: folder.color }
            : project
              ? { id: project, label: project }
              : null,
        },
      ];
    });
  }

  async getTime(
    userId: string,
    startValue: string,
    endValue: string,
    timeZone: string,
    bucketValue = 'day',
    dimensionValue = 'tag',
  ) {
    const range = parseAnalyticsRange(startValue, endValue, timeZone);
    const bucket = requireOption(bucketValue, buckets, 'bucket');
    const dimension = requireOption(dimensionValue, dimensions, 'dimension');
    const duration = range.end.getTime() - range.start.getTime();
    const previousStart = new Date(range.start.getTime() - duration);
    const [facts, previousFacts, tagRecords, appSessions] = await Promise.all([
      this.loadActualFacts(userId, range.start, range.end),
      this.loadActualFacts(userId, previousStart, range.start),
      dimension === 'tag'
        ? this.prisma.tag.findMany({
            where: { userId },
            select: { name: true, color: true },
          })
        : Promise.resolve([]),
      this.prisma.appUsageSession?.findMany({
        where: { userId, startTime: { lt: range.end }, endTime: { gt: range.start } },
        orderBy: { startTime: 'desc' },
        take: 10_001,
        select: { startTime: true, endTime: true, tagName: true },
      }) ?? Promise.resolve([]),
    ]);
    const appTagSeconds = new Map<string, number>();
    for (const session of appSessions.slice(0, 10_000)) {
      const tag = session.tagName || '未分类';
      appTagSeconds.set(tag, (appTagSeconds.get(tag) ?? 0) +
        overlapSeconds(session.startTime, session.endTime, range.start, range.end));
    }
    const tagColors = new Map(tagRecords.map((tag) => [tag.name, tag.color]));
    const bucketMap = new Map<
      string,
      { actualSeconds: number; sessionCount: number }
    >();
    const breakdownMap = new Map<
      string,
      {
        label: string;
        actualSeconds: number;
        sessionCount: number;
        color?: string;
      }
    >();

    for (const fact of facts) {
      const key = bucketKey(fact.start, timeZone, bucket);
      const currentBucket = bucketMap.get(key) ?? {
        actualSeconds: 0,
        sessionCount: 0,
      };
      currentBucket.actualSeconds += fact.effectiveDurationSeconds;
      currentBucket.sessionCount += 1;
      bucketMap.set(key, currentBucket);

      const parts = dimensionParts(fact, dimension);
      const baseSeconds = Math.floor(
        fact.effectiveDurationSeconds / parts.length,
      );
      let remainder =
        fact.effectiveDurationSeconds - baseSeconds * parts.length;
      for (const part of parts) {
        const seconds = baseSeconds + (remainder > 0 ? 1 : 0);
        remainder = Math.max(0, remainder - 1);
        const current = breakdownMap.get(part.key) ?? {
          label: part.label,
          actualSeconds: 0,
          sessionCount: 0,
          color: part.color ?? tagColors.get(part.key),
        };
        current.actualSeconds += seconds;
        current.sessionCount += 1;
        breakdownMap.set(part.key, current);
      }
    }

    const totalActualSeconds = facts.reduce(
      (sum, fact) => sum + fact.effectiveDurationSeconds,
      0,
    );
    return {
      range: {
        start: range.start.toISOString(),
        end: range.end.toISOString(),
        timeZone,
      },
      totalActualSeconds,
      previousTotalActualSeconds: previousFacts.reduce(
        (sum, fact) => sum + fact.effectiveDurationSeconds,
        0,
      ),
      appUsage: {
        totalSeconds: [...appTagSeconds.values()].reduce((sum, seconds) => sum + seconds, 0),
        sessionCount: Math.min(appSessions.length, 10_000),
        truncated: appSessions.length > 10_000,
        byTag: [...appTagSeconds.entries()].map(([name, seconds]) => ({ name, seconds }))
          .sort((a, b) => b.seconds - a.seconds),
      },
      buckets: [...bucketMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => ({
          key,
          start: key,
          end: bucketEnd(key, bucket),
          ...value,
        })),
      breakdown: [...breakdownMap.entries()]
        .map(([key, value]) => ({ key, ...value }))
        .sort((left, right) => right.actualSeconds - left.actualSeconds),
    };
  }

  async getPlanActual(
    userId: string,
    startValue: string,
    endValue: string,
    timeZone: string,
    groupByValue = 'day',
  ) {
    const range = parseAnalyticsRange(startValue, endValue, timeZone);
    const groupBy = requireOption(groupByValue, planGroups, 'groupBy');
    const [actualFacts, events, tasks] = await Promise.all([
      this.loadActualFacts(userId, range.start, range.end),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          startTime: { lt: range.end },
          endTime: { gt: range.start },
        },
        select: {
          id: true,
          taskId: true,
          courseId: true,
          focusSessionId: true,
          title: true,
          eventType: true,
          startTime: true,
          endTime: true,
          isAllDay: true,
          task: {
            select: {
              tags: true,
              project: true,
              studyFolders: {
                take: 1,
                select: {
                  folder: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          scheduledStart: { lt: range.end },
          OR: [{ scheduledEnd: { gt: range.start } }, { scheduledEnd: null }],
        },
        select: {
          id: true,
          title: true,
          scheduledStart: true,
          scheduledEnd: true,
          estimatedMinutes: true,
          tags: true,
          project: true,
          studyFolders: {
            take: 1,
            select: {
              folder: { select: { id: true, name: true, color: true } },
            },
          },
        },
      }),
    ]);
    const plannedFacts = projectPlannedFacts(events, tasks).filter(
      (fact) => fact.start < range.end && fact.end > range.start,
    );
    const matches = actualFacts.map((actual) =>
      matchActualToPlanned(actual, plannedFacts),
    );
    const matchByActualId = new Map(
      matches.map((match) => [match.actualId, match]),
    );
    const groups = new Map<
      string,
      {
        label: string;
        plannedSeconds: number;
        actualSeconds: number;
        color?: string;
      }
    >();

    for (const planned of plannedFacts) {
      const group = factGroup(planned, groupBy, timeZone);
      const current = groups.get(group.key) ?? {
        label: group.label,
        plannedSeconds: 0,
        actualSeconds: 0,
        color: group.color,
      };
      current.plannedSeconds += overlapSeconds(
        planned.start,
        planned.end,
        range.start,
        range.end,
      );
      groups.set(group.key, current);
    }
    for (const actual of actualFacts) {
      const group = factGroup(actual, groupBy, timeZone);
      const current = groups.get(group.key) ?? {
        label: group.label,
        plannedSeconds: 0,
        actualSeconds: 0,
        color: group.color,
      };
      current.actualSeconds += actual.effectiveDurationSeconds;
      groups.set(group.key, current);
    }

    const plannedSeconds = plannedFacts.reduce(
      (sum, fact) =>
        sum + overlapSeconds(fact.start, fact.end, range.start, range.end),
      0,
    );
    const actualSeconds = actualFacts.reduce(
      (sum, fact) => sum + fact.effectiveDurationSeconds,
      0,
    );
    const matchedActualSeconds = actualFacts.reduce(
      (sum, fact) =>
        matchByActualId.get(fact.id)?.confidence !== 'none'
          ? sum + fact.effectiveDurationSeconds
          : sum,
      0,
    );

    return {
      plannedSeconds,
      actualSeconds,
      deltaSeconds: actualSeconds - plannedSeconds,
      matchedActualSeconds,
      unplannedActualSeconds: actualSeconds - matchedActualSeconds,
      groups: [...groups.entries()]
        .map(([key, value]) => ({
          key,
          ...value,
          deltaSeconds: value.actualSeconds - value.plannedSeconds,
        }))
        .sort(
          (left, right) =>
            right.actualSeconds +
            right.plannedSeconds -
            left.actualSeconds -
            left.plannedSeconds,
        ),
      matches,
    };
  }

  async getHeatmap(
    userId: string,
    startValue: string,
    endValue: string,
    timeZone: string,
    filterTypeValue = 'all',
    filterId?: string,
  ) {
    const range = parseAnalyticsRange(startValue, endValue, timeZone);
    const filterType = requireOption(
      filterTypeValue,
      ['all', 'tag', 'goal', 'scene'],
      'filterType',
    );
    if (filterType !== 'all' && !filterId) {
      throw new BadRequestException(
        'filterId is required for filtered heatmaps',
      );
    }
    let facts = await this.loadActualFacts(userId, range.start, range.end);
    if (filterType === 'tag')
      facts = facts.filter((fact) => fact.tags.includes(filterId!));
    if (filterType === 'goal')
      facts = facts.filter((fact) => fact.goal?.id === filterId);
    if (filterType === 'scene') facts = [];

    const totals = new Map<string, { actualSeconds: number; count: number }>();
    for (const fact of facts) {
      const date = localDateKey(fact.start, timeZone);
      const current = totals.get(date) ?? { actualSeconds: 0, count: 0 };
      current.actualSeconds += fact.effectiveDurationSeconds;
      current.count += 1;
      totals.set(date, current);
    }
    const maxActualSeconds = Math.max(
      0,
      ...[...totals.values()].map((value) => value.actualSeconds),
    );
    return {
      days: enumerateLocalDays(range.start, range.end, timeZone).map((date) => {
        const value = totals.get(date) ?? { actualSeconds: 0, count: 0 };
        return {
          date,
          ...value,
          level:
            value.actualSeconds === 0 || maxActualSeconds === 0
              ? 0
              : Math.max(
                  1,
                  Math.ceil((value.actualSeconds / maxActualSeconds) * 4),
                ),
        };
      }),
      maxActualSeconds,
    };
  }
}
