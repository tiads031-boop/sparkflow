import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PomodoroSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateFocusTiming, focusCompletionTime } from './focus-timing';

const openStatuses = ['active', 'paused'];
const sessionInclude = {
  task: { select: { id: true, title: true } },
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

  async findActive(userId: string) {
    const session = await this.findOpen(userId);
    if (!session) return null;
    const presented = this.present(session);
    if (session.status === 'active' && presented.remainingSeconds === 0) {
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
        where: { userId, status: 'completed', startedAt: { gte: today } },
        select: { effectiveDurationSeconds: true },
      }),
      this.prisma.pomodoroSession.count({
        where: { userId, status: 'completed', startedAt: { gte: weekStart } },
      }),
      this.prisma.pomodoroSession.aggregate({
        where: { userId, status: 'completed' },
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

  async create(data: {
    userId: string;
    taskId?: string;
    duration?: number;
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
      if (existing.status !== 'active' || presented.remainingSeconds > 0) return presented;
      await this.complete(existing.id, data.userId, existing.revision);
    }

    const now = new Date();
    const duration = Math.min(
      180,
      Math.max(5, Math.round(data.duration ?? 25)),
    );
    try {
      const session = await this.prisma.pomodoroSession.create({
        data: {
          userId: data.userId,
          taskId: data.taskId || null,
          duration,
          plannedDurationSeconds: duration * 60,
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

  async pause(id: string, userId: string, expectedRevision?: number) {
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
