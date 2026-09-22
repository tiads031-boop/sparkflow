import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PomodoroSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateFocusTiming, focusCompletionTime } from './focus-timing';
import { parseTimeTrackingPreferences } from '../users/time-tracking-preferences';
import { attachDefaultFocusScene } from '../scenes/scene-trigger';

const openStatuses = ['active', 'paused'];
const sessionInclude = {
  task: { select: { id: true, title: true, tags: true } },
  segments: { orderBy: { startedAt: 'asc' as const } },
  calendarEvent: { select: { id: true } },
};

@Injectable()
export class PomodoroService {
  constructor(private prisma: PrismaService) {}

  private present<
    T extends PomodoroSession & {
      segments: Array<{ startedAt: Date; endedAt: Date | null }>;
    },
  >(session: T) {
    return { ...session, ...calculateFocusTiming(session) };
  }

  private findOpen(userId: string) {
    return this.prisma.pomodoroSession.findFirst({
      where: { userId, status: { in: openStatuses } },
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
    });
  }

  findAll(userId: string, date?: string) {
    const where: Prisma.PomodoroSessionWhereInput = { userId };
    if (date) {
      const d = new Date(date);
      where.startedAt = { gte: d, lt: new Date(d.getTime() + 86_400_000) };
    }
    return this.prisma.pomodoroSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: sessionInclude,
    });
  }

  async findTimeline(userId: string, startValue: string, endValue: string) {
    const { start, end } = this.parseRange(startValue, endValue);
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
      include: sessionInclude,
    });

    return sessions.map((session) => ({
      id: session.id,
      taskId: session.taskId,
      title:
        session.title?.trim() ||
        session.task?.title ||
        (session.entrySource === 'manual' ? '手工时间记录' : '自由专注'),
      start: session.startedAt.toISOString(),
      end: session.endedAt?.toISOString() ?? session.startedAt.toISOString(),
      effectiveDurationSeconds: session.effectiveDurationSeconds,
      pausedDurationSeconds: session.pausedDurationSeconds,
      source: session.entrySource === 'manual' ? 'manual' : 'focus',
      status: session.status,
      notes: session.notes,
      tags: session.tags.length ? session.tags : (session.task?.tags ?? []),
      revision: session.revision,
    }));
  }

  async findActive(userId: string) {
    const session = await this.findOpen(userId);
    if (!session) return null;
    const presented = this.present(session);
    if (
      session.status === 'active' &&
      session.focusMode !== 'countup' &&
      presented.remainingSeconds === 0
    ) {
      return this.complete(session.id, userId, session.revision);
    }
    return presented;
  }

  async getStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today.getTime() - 7 * 86_400_000);
    const [todaySessions, weekCount, total] = await Promise.all([
      this.prisma.pomodoroSession.findMany({
        where: {
          userId,
          countsTowardActual: true,
          status: { in: ['completed', 'interrupted'] },
          effectiveDurationSeconds: { gt: 0 },
          startedAt: { gte: today },
        },
        select: { effectiveDurationSeconds: true },
      }),
      this.prisma.pomodoroSession.count({
        where: {
          userId,
          countsTowardActual: true,
          status: { in: ['completed', 'interrupted'] },
          effectiveDurationSeconds: { gt: 0 },
          startedAt: { gte: weekStart },
        },
      }),
      this.prisma.pomodoroSession.aggregate({
        where: {
          userId,
          countsTowardActual: true,
          status: { in: ['completed', 'interrupted'] },
          effectiveDurationSeconds: { gt: 0 },
        },
        _sum: { effectiveDurationSeconds: true },
      }),
    ]);
    return {
      todayCount: todaySessions.length,
      weekCount,
      todayMinutes: Math.round(
        todaySessions.reduce(
          (sum, item) => sum + item.effectiveDurationSeconds,
          0,
        ) / 60,
      ),
      totalMinutes: Math.round((total._sum.effectiveDurationSeconds ?? 0) / 60),
    };
  }

  async remove(id: string, userId: string) {
    const session = await this.prisma.pomodoroSession.findFirst({
      where: { id, userId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException('Pomodoro session not found');
    if (openStatuses.includes(session.status)) {
      throw new ConflictException('Active focus sessions cannot be deleted');
    }
    return this.prisma.pomodoroSession.delete({ where: { id } });
  }

  async create(data: {
    userId: string;
    taskId?: string;
    duration?: number;
    focusMode?: 'countdown' | 'countup';
    notes?: string;
    clientRequestId?: string;
  }) {
    if (data.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: data.taskId, userId: data.userId },
        select: { id: true },
      });
      if (!task) throw new NotFoundException('Task not found');
    }
    const existing = await this.findOpen(data.userId);
    if (existing) {
      const presented = this.present(existing);
      if (
        existing.status !== 'active' ||
        existing.focusMode === 'countup' ||
        presented.remainingSeconds > 0
      )
        return presented;
      await this.complete(existing.id, data.userId, existing.revision);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const preferences = parseTimeTrackingPreferences(user.settings);
    const now = new Date();
    const focusMode = data.focusMode === 'countup' ? 'countup' : 'countdown';
    const duration = Math.min(
      180,
      Math.max(5, Math.round(data.duration ?? 25)),
    );
    try {
      const session = await this.prisma.pomodoroSession.create({
        data: {
          userId: data.userId,
          countsTowardActual: preferences.focusActualEnabled,
          taskId: data.taskId || null,
          duration,
          focusMode,
          plannedDurationSeconds: focusMode === 'countup' ? 0 : duration * 60,
          lastResumedAt: now,
          notes: data.notes,
          clientRequestId: data.clientRequestId,
          segments: { create: { startedAt: now } },
        },
        include: sessionInclude,
      });
      return this.present(session);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const recovered = await this.findActive(data.userId);
        if (recovered) return recovered;
      }
      throw error;
    }
  }

  async createManual(data: {
    userId: string;
    title?: string;
    taskId?: string;
    startedAt: string;
    endedAt: string;
    notes?: string;
    tags?: string[];
    clientRequestId?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!parseTimeTrackingPreferences(user.settings).manualBackfillEnabled)
      throw new BadRequestException('手工补记已关闭');
    const { startedAt, endedAt, elapsedSeconds } = this.parseManualRange(
      data.startedAt,
      data.endedAt,
    );

    const tags = this.normalizeTags(data.tags);
    const title = data.title?.trim().slice(0, 120) || null;
    const notes = data.notes?.trim().slice(0, 2000) || null;

    try {
      return await this.prisma.$transaction(async (tx) => {
        let task: { id: string; title: string; tags: string[] } | null = null;
        if (data.taskId) {
          task = await tx.task.findFirst({
            where: { id: data.taskId, userId: data.userId },
            select: { id: true, title: true, tags: true },
          });
          if (!task) throw new NotFoundException('Task not found');
        }
        for (const [sortOrder, name] of tags.entries()) {
          await tx.tag.upsert({
            where: { userId_name: { userId: data.userId, name } },
            create: { userId: data.userId, name, sortOrder },
            update: { archived: false },
          });
        }
        const session = await tx.pomodoroSession.create({
          data: {
            userId: data.userId,
            taskId: task?.id ?? null,
            title,
            entrySource: 'manual',
            countsTowardActual: true,
            tags,
            duration: Math.max(1, Math.ceil(elapsedSeconds / 60)),
            focusMode: 'countup',
            plannedDurationSeconds: 0,
            effectiveDurationSeconds: elapsedSeconds,
            pausedDurationSeconds: 0,
            startedAt,
            endedAt,
            lastResumedAt: null,
            pausedAt: null,
            status: 'completed',
            notes,
            clientRequestId: data.clientRequestId,
            segments: { create: { startedAt, endedAt } },
          },
          include: sessionInclude,
        });
        return this.present(session);
      });
    } catch (error) {
      if (
        data.clientRequestId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const recovered = await this.prisma.pomodoroSession.findFirst({
          where: { userId: data.userId, clientRequestId: data.clientRequestId },
          include: sessionInclude,
        });
        if (recovered) return this.present(recovered);
      }
      throw error;
    }
  }

  async updateManual(
    id: string,
    userId: string,
    data: {
      expectedRevision: number;
      title?: string;
      taskId?: string | null;
      startedAt: string;
      endedAt: string;
      notes?: string;
      tags?: string[];
    },
  ) {
    if (!Number.isInteger(data.expectedRevision)) {
      throw new BadRequestException('Expected revision is required');
    }
    const { startedAt, endedAt, elapsedSeconds } = this.parseManualRange(
      data.startedAt,
      data.endedAt,
    );
    const tags = this.normalizeTags(data.tags);
    const title = data.title?.trim().slice(0, 120) || null;
    const notes = data.notes?.trim().slice(0, 2000) || null;

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pomodoroSession.findFirst({
        where: { id, userId },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Pomodoro session not found');
      if (session.entrySource !== 'manual') {
        throw new BadRequestException('Only manual actual time can be edited');
      }
      if (session.revision !== data.expectedRevision) {
        throw new ConflictException(
          'Actual time changed on another device; refresh and retry',
        );
      }

      let task: { id: string; title: string; tags: string[] } | null = null;
      if (data.taskId) {
        task = await tx.task.findFirst({
          where: { id: data.taskId, userId },
          select: { id: true, title: true, tags: true },
        });
        if (!task) throw new NotFoundException('Task not found');
      }
      for (const [sortOrder, name] of tags.entries()) {
        await tx.tag.upsert({
          where: { userId_name: { userId, name } },
          create: { userId, name, sortOrder },
          update: { archived: false },
        });
      }

      const changed = await tx.pomodoroSession.updateMany({
        where: {
          id,
          userId,
          entrySource: 'manual',
          revision: data.expectedRevision,
        },
        data: {
          taskId: task?.id ?? null,
          title,
          tags,
          duration: Math.max(1, Math.ceil(elapsedSeconds / 60)),
          effectiveDurationSeconds: elapsedSeconds,
          startedAt,
          endedAt,
          notes,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'Actual time changed on another device; refresh and retry',
        );
      }
      await tx.pomodoroSegment.deleteMany({ where: { sessionId: id } });
      await tx.pomodoroSegment.create({
        data: { sessionId: id, startedAt, endedAt },
      });
      const updated = await tx.pomodoroSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      return this.present(updated);
    });
  }

  async pause(id: string, userId: string, expectedRevision?: number) {
    const open = await this.findOpen(userId);
    if (
      open?.id === id &&
      open.focusMode !== 'countup' &&
      this.present(open).remainingSeconds === 0
    ) {
      return this.complete(id, userId, expectedRevision);
    }
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pomodoroSession.findFirst({
        where: { id, userId },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Pomodoro session not found');
      if (session.status === 'paused') return this.present(session);
      this.assertOpenRevision(session, expectedRevision, 'active');
      const now = focusCompletionTime(session);
      await tx.pomodoroSegment.updateMany({
        where: { sessionId: id, endedAt: null },
        data: { endedAt: now },
      });
      const closedSegments = session.segments.map((segment) =>
        segment.endedAt ? segment : { ...segment, endedAt: now },
      );
      const timing = calculateFocusTiming({
        ...session,
        segments: closedSegments,
        endedAt: now,
      });
      const changed = await tx.pomodoroSession.updateMany({
        where: {
          id,
          userId,
          status: session.status,
          revision: session.revision,
        },
        data: {
          status: 'paused',
          pausedAt: now,
          lastResumedAt: null,
          effectiveDurationSeconds: timing.effectiveDurationSeconds,
          pausedDurationSeconds: timing.pausedDurationSeconds,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Session changed on another device; refresh and retry',
        );
      const updated = await tx.pomodoroSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      return this.present(updated);
    });
  }

  async resume(id: string, userId: string, expectedRevision?: number) {
    const open = await this.findOpen(userId);
    if (
      open?.id === id &&
      open.focusMode !== 'countup' &&
      this.present(open).remainingSeconds === 0
    ) {
      return this.complete(id, userId, expectedRevision);
    }
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pomodoroSession.findFirst({
        where: { id, userId },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Pomodoro session not found');
      if (session.status === 'active') return this.present(session);
      this.assertOpenRevision(session, expectedRevision, 'paused');
      const now = new Date();
      await tx.pomodoroSegment.create({
        data: { sessionId: id, startedAt: now },
      });
      const changed = await tx.pomodoroSession.updateMany({
        where: {
          id,
          userId,
          status: session.status,
          revision: session.revision,
        },
        data: {
          status: 'active',
          pausedAt: null,
          lastResumedAt: now,
          interruptionCount: { increment: 1 },
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Session changed on another device; refresh and retry',
        );
      const updated = await tx.pomodoroSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      return this.present(updated);
    });
  }

  async complete(id: string, userId: string, expectedRevision?: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pomodoroSession.findFirst({
        where: { id, userId },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Pomodoro session not found');
      if (session.status === 'completed') return this.present(session);
      this.assertOpenRevision(session, expectedRevision);

      const endedAt = focusCompletionTime(session);
      await tx.pomodoroSegment.updateMany({
        where: { sessionId: id, endedAt: null },
        data: { endedAt },
      });
      const closedSegments = session.segments.map((segment) =>
        segment.endedAt ? segment : { ...segment, endedAt },
      );
      const timing = calculateFocusTiming({
        ...session,
        segments: closedSegments,
        endedAt,
      });
      const changed = await tx.pomodoroSession.updateMany({
        where: {
          id,
          userId,
          status: session.status,
          revision: session.revision,
        },
        data: {
          status: 'completed',
          endedAt,
          pausedAt: null,
          lastResumedAt: null,
          duration: Math.max(
            1,
            Math.ceil(timing.effectiveDurationSeconds / 60),
          ),
          effectiveDurationSeconds: timing.effectiveDurationSeconds,
          pausedDurationSeconds: timing.pausedDurationSeconds,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Session changed on another device; refresh and retry',
        );
      const updated = await tx.pomodoroSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      await tx.calendarEvent.upsert({
        where: { focusSessionId: id },
        update: {
          title: session.task?.title
            ? `专注 · ${session.task.title}`
            : '自由专注',
          startTime: session.startedAt,
          endTime: endedAt,
        },
        create: {
          userId,
          focusSessionId: id,
          taskId: null,
          title: session.task?.title
            ? `专注 · ${session.task.title}`
            : '自由专注',
          eventType: 'focus',
          startTime: session.startedAt,
          endTime: endedAt,
          color: '#B8A1E3',
          syncStatus: 'skipped',
          scheduleLocked: true,
        },
      });
      await attachDefaultFocusScene(tx, updated);
      return this.present(updated);
    });
  }

  async interrupt(id: string, userId: string, expectedRevision?: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await tx.pomodoroSession.findFirst({
        where: { id, userId },
        include: sessionInclude,
      });
      if (!session) throw new NotFoundException('Pomodoro session not found');
      if (session.status === 'interrupted') return this.present(session);
      this.assertOpenRevision(session, expectedRevision);
      const endedAt = new Date();
      await tx.pomodoroSegment.updateMany({
        where: { sessionId: id, endedAt: null },
        data: { endedAt },
      });
      const closedSegments = session.segments.map((segment) =>
        segment.endedAt ? segment : { ...segment, endedAt },
      );
      const timing = calculateFocusTiming({
        ...session,
        segments: closedSegments,
        endedAt,
      });
      const changed = await tx.pomodoroSession.updateMany({
        where: {
          id,
          userId,
          status: session.status,
          revision: session.revision,
        },
        data: {
          status: 'interrupted',
          endedAt,
          pausedAt: null,
          lastResumedAt: null,
          duration: Math.max(
            1,
            Math.ceil(timing.effectiveDurationSeconds / 60),
          ),
          effectiveDurationSeconds: timing.effectiveDurationSeconds,
          pausedDurationSeconds: timing.pausedDurationSeconds,
          revision: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Session changed on another device; refresh and retry',
        );
      const updated = await tx.pomodoroSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      await attachDefaultFocusScene(tx, updated);
      return this.present(updated);
    });
  }

  private normalizeTags(values?: string[]) {
    if (!Array.isArray(values)) return [];
    return [
      ...new Set(
        values
          .map((value) => value.replace(/^#+/, '').trim().slice(0, 40))
          .filter(Boolean),
      ),
    ].slice(0, 12);
  }

  private parseManualRange(startValue: string, endValue: string) {
    const startedAt = new Date(startValue);
    const endedAt = new Date(endValue);
    const elapsedSeconds = Math.round(
      (endedAt.getTime() - startedAt.getTime()) / 1000,
    );
    if (
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      elapsedSeconds <= 0
    ) {
      throw new BadRequestException('Actual time range is invalid');
    }
    if (elapsedSeconds > 24 * 60 * 60) {
      throw new BadRequestException('Actual time cannot exceed 24 hours');
    }
    if (endedAt.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('Actual time cannot end in the future');
    }
    return { startedAt, endedAt, elapsedSeconds };
  }

  private parseRange(startValue: string, endValue: string) {
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start >= end
    ) {
      throw new BadRequestException('Timeline range is invalid');
    }
    if (end.getTime() - start.getTime() > 366 * 86_400_000) {
      throw new BadRequestException('Timeline range is too large');
    }
    return { start, end };
  }

  private assertOpenRevision(
    session: { status: string; revision: number },
    expectedRevision?: number,
    requiredStatus?: string,
  ) {
    if (
      !openStatuses.includes(session.status) ||
      (requiredStatus && session.status !== requiredStatus)
    ) {
      throw new ConflictException(`Session is ${session.status}`);
    }
    if (
      expectedRevision !== undefined &&
      expectedRevision !== session.revision
    ) {
      throw new ConflictException(
        'Session changed on another device; refresh and retry',
      );
    }
  }
}
