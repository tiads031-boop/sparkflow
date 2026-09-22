import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScenesService } from './scenes.service';

@Injectable()
export class SceneAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scenes: ScenesService,
  ) {}

  async summarize(
    userId: string,
    sceneId: string,
    query: {
      start?: string;
      end?: string;
      timeZone?: string;
      bucket?: string;
      metric?: string;
    },
  ) {
    await this.scenes.get(userId, sceneId);
    const start = new Date(query.start || '');
    const end = new Date(query.end || '');
    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      start >= end ||
      end.getTime() - start.getTime() > 370 * 86_400_000
    )
      throw new BadRequestException('时间范围无效，最长 370 天');
    const timeZone = query.timeZone || 'UTC';
    let dayFormat: Intl.DateTimeFormat;
    try {
      dayFormat = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      dayFormat.format(start);
    } catch {
      throw new BadRequestException('时区无效');
    }
    const bucket = query.bucket || 'day';
    const metric = query.metric || 'count';
    if (
      !['day', 'week', 'month'].includes(bucket) ||
      !['duration', 'count', 'rating'].includes(metric)
    )
      throw new BadRequestException('聚合参数无效');
    const rows = await this.prisma.sceneEntry.findMany({
      where: { userId, sceneId, occurredAt: { gte: start, lt: end } },
      select: {
        occurredAt: true,
        metadata: true,
        inspiration: { select: { attachments: { select: { kind: true } } } },
        pomodoroSession: {
          select: {
            effectiveDurationSeconds: true,
            status: true,
            countsTowardActual: true,
          },
        },
      },
      orderBy: { occurredAt: 'asc' },
    });
    const days = new Map<
      string,
      {
        count: number;
        durationSeconds: number;
        ratingTotal: number;
        ratingCount: number;
      }
    >();
    let hasImages = false;
    for (const row of rows) {
      const parts = dayFormat.formatToParts(row.occurredAt);
      const get = (part: string) =>
        parts.find((item) => item.type === part)!.value;
      const day = `${get('year')}-${get('month')}-${get('day')}`;
      const value = days.get(day) || {
        count: 0,
        durationSeconds: 0,
        ratingTotal: 0,
        ratingCount: 0,
      };
      value.count++;
      if (
        row.pomodoroSession?.countsTowardActual &&
        ['completed', 'interrupted'].includes(row.pomodoroSession.status)
      )
        value.durationSeconds += Math.max(
          0,
          row.pomodoroSession.effectiveDurationSeconds,
        );
      const metadata =
        row.metadata &&
        typeof row.metadata === 'object' &&
        !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      if (
        typeof metadata.rating === 'number' &&
        Number.isFinite(metadata.rating)
      ) {
        value.ratingTotal += metadata.rating;
        value.ratingCount++;
      }
      hasImages ||= !!row.inspiration?.attachments.some(
        (attachment) => attachment.kind === 'image',
      );
      days.set(day, value);
    }
    const aggregates = new Map<
      string,
      {
        count: number;
        durationSeconds: number;
        ratingTotal: number;
        ratingCount: number;
      }
    >();
    for (const [day, value] of days) {
      const d = new Date(`${day}T12:00:00Z`);
      if (bucket === 'week')
        d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      const key =
        bucket === 'day'
          ? day
          : bucket === 'month'
            ? day.slice(0, 7)
            : d.toISOString().slice(0, 10);
      const prior = aggregates.get(key) || {
        count: 0,
        durationSeconds: 0,
        ratingTotal: 0,
        ratingCount: 0,
      };
      prior.count += value.count;
      prior.durationSeconds += value.durationSeconds;
      prior.ratingTotal += value.ratingTotal;
      prior.ratingCount += value.ratingCount;
      aggregates.set(key, prior);
    }
    const totalDurationSeconds = rows.reduce(
      (sum, row) =>
        sum +
        (row.pomodoroSession?.countsTowardActual &&
        ['completed', 'interrupted'].includes(row.pomodoroSession.status)
          ? Math.max(0, row.pomodoroSession.effectiveDurationSeconds)
          : 0),
      0,
    );
    const ratings = [...days.values()].reduce(
      (sum, item) => ({
        total: sum.total + item.ratingTotal,
        count: sum.count + item.ratingCount,
      }),
      { total: 0, count: 0 },
    );
    return {
      totalDurationSeconds,
      totalCount: rows.length,
      averageRating: ratings.count ? ratings.total / ratings.count : null,
      buckets: [...aggregates].map(([key, value]) => ({
        key,
        count: value.count,
        durationSeconds: value.durationSeconds,
        averageRating: value.ratingCount
          ? value.ratingTotal / value.ratingCount
          : null,
      })),
      heatmap: [...days].map(([date, value]) => ({
        date,
        count: value.count,
        durationSeconds: value.durationSeconds,
      })),
      hasImages,
      metric,
      timeZone,
    };
  }
}
