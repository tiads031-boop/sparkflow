import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  buildSchedule,
  hasOverlap,
  type BusyInterval,
  type PlannerProposal,
} from './planner.scheduler';

type ApplyProposal = PlannerProposal;

interface StoredScheduleState {
  taskId: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedMinutes: number | null;
  scheduleSource: string;
}

function parseDate(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new BadRequestException(`${label} is invalid`);
  return date;
}

function sameInstant(value: Date | null, expected: string | null) {
  return (value?.toISOString() ?? null) === expected;
}

function readStoredState(value: unknown): StoredScheduleState[] {
  if (!Array.isArray(value))
    throw new ConflictException('Stored schedule plan is invalid');
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new ConflictException('Stored schedule plan is invalid');
    const item = entry as Record<string, unknown>;
    if (
      typeof item.taskId !== 'string' ||
      (item.scheduledStart !== null &&
        typeof item.scheduledStart !== 'string') ||
      (item.scheduledEnd !== null && typeof item.scheduledEnd !== 'string') ||
      (item.estimatedMinutes !== null &&
        typeof item.estimatedMinutes !== 'number') ||
      typeof item.scheduleSource !== 'string'
    ) {
      throw new ConflictException('Stored schedule plan is invalid');
    }
    return {
      taskId: item.taskId,
      scheduledStart: item.scheduledStart,
      scheduledEnd: item.scheduledEnd,
      estimatedMinutes: item.estimatedMinutes,
      scheduleSource: item.scheduleSource,
    };
  });
}

@Injectable()
export class PlannerService {
  constructor(private prisma: PrismaService) {}

  async preview(
    userId: string,
    data: {
      availabilityStart: string;
      availabilityEnd: string;
      planningThreadId?: string;
    },
  ) {
    let availabilityStart = parseDate(
      data.availabilityStart,
      'availabilityStart',
    );
    const availabilityEnd = parseDate(data.availabilityEnd, 'availabilityEnd');
    if (availabilityEnd <= availabilityStart)
      throw new BadRequestException(
        'availabilityEnd must be after availabilityStart',
      );
    if (
      availabilityEnd.getTime() - availabilityStart.getTime() >
      7 * 86400000
    ) {
      throw new BadRequestException('Planning range cannot exceed 7 days');
    }
    const now = new Date();
    if (availabilityStart < now && now < availabilityEnd)
      availabilityStart = now;

    let goalScopeId: string | null = null;
    if (data.planningThreadId) {
      const thread = await this.prisma.planningThread.findFirst({
        where: { id: data.planningThreadId, userId, status: 'active' },
        select: { scopeType: true, scopeId: true },
      });
      if (!thread) throw new NotFoundException('Planning thread not found');
      goalScopeId = thread.scopeType === 'goal' ? thread.scopeId : null;
    }

    const [tasks, scheduledTasks, events] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          status: { notIn: ['done', 'cancelled'] },
          scheduleLocked: false,
          scheduledStart: null,
          ...(goalScopeId
            ? {
                studyFolders: {
                  some: { folderId: goalScopeId },
                },
              }
            : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          status: { notIn: ['done', 'cancelled'] },
          scheduledStart: { lt: availabilityEnd },
          scheduledEnd: { gt: availabilityStart },
        },
        select: { scheduledStart: true, scheduledEnd: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          startTime: { lt: availabilityEnd },
          endTime: { gt: availabilityStart },
        },
        select: { startTime: true, endTime: true },
      }),
    ]);

    const occupied: BusyInterval[] = [
      ...scheduledTasks.flatMap((task) =>
        task.scheduledStart && task.scheduledEnd
          ? [{ start: task.scheduledStart, end: task.scheduledEnd }]
          : [],
      ),
      ...events.map((event) => ({
        start: event.startTime,
        end: event.endTime,
      })),
    ];
    const result = buildSchedule(
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        durationMinutes: task.estimatedMinutes ?? 30,
        priority: task.priority,
        dueAt: task.dueDate,
        updatedAt: task.updatedAt,
      })),
      occupied,
      availabilityStart,
      availabilityEnd,
    );

    return {
      ...result,
      range: {
        start: availabilityStart.toISOString(),
        end: availabilityEnd.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async replanPreview(
    userId: string,
    data: {
      blockedStart: string;
      blockedEnd: string;
      planningStart: string;
      planningEnd: string;
      planningThreadId?: string;
    },
  ) {
    const blockedStart = parseDate(data.blockedStart, 'blockedStart');
    const blockedEnd = parseDate(data.blockedEnd, 'blockedEnd');
    let planningStart = parseDate(data.planningStart, 'planningStart');
    const planningEnd = parseDate(data.planningEnd, 'planningEnd');

    if (blockedEnd <= blockedStart)
      throw new BadRequestException('blockedEnd must be after blockedStart');
    if (planningEnd <= planningStart)
      throw new BadRequestException('planningEnd must be after planningStart');
    if (planningEnd.getTime() - planningStart.getTime() > 7 * 86400000)
      throw new BadRequestException('Planning range cannot exceed 7 days');
    if (blockedStart >= planningEnd || blockedEnd <= planningStart)
      throw new BadRequestException('Blocked interval must intersect the planning range');

    const now = new Date();
    if (planningStart < now && now < planningEnd) planningStart = now;

    let goalScopeId: string | null = null;
    if (data.planningThreadId) {
      const thread = await this.prisma.planningThread.findFirst({
        where: { id: data.planningThreadId, userId, status: 'active' },
        select: { scopeType: true, scopeId: true },
      });
      if (!thread) throw new NotFoundException('Planning thread not found');
      goalScopeId = thread.scopeType === 'goal' ? thread.scopeId : null;
    }

    const affectedTasks = await this.prisma.task.findMany({
      where: {
        userId,
        status: { notIn: ['done', 'cancelled'] },
        scheduleLocked: false,
        scheduledStart: { lt: blockedEnd },
        scheduledEnd: { gt: blockedStart },
        ...(goalScopeId
          ? {
              studyFolders: {
                some: { folderId: goalScopeId },
              },
            }
          : {}),
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });

    const affectedIds = affectedTasks.map((task) => task.id);
    if (!affectedIds.length) {
      return {
        proposals: [],
        unscheduledTaskIds: [],
        affectedTaskIds: [],
        blockedRange: {
          start: blockedStart.toISOString(),
          end: blockedEnd.toISOString(),
        },
        range: {
          start: planningStart.toISOString(),
          end: planningEnd.toISOString(),
        },
        generatedAt: new Date().toISOString(),
      };
    }

    const [fixedTasks, events] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          userId,
          id: { notIn: affectedIds },
          status: { notIn: ['done', 'cancelled'] },
          scheduledStart: { lt: planningEnd },
          scheduledEnd: { gt: planningStart },
        },
        select: { scheduledStart: true, scheduledEnd: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          startTime: { lt: planningEnd },
          endTime: { gt: planningStart },
        },
        select: { startTime: true, endTime: true, taskId: true },
      }),
    ]);

    const occupied: BusyInterval[] = [
      ...fixedTasks.flatMap((task) =>
        task.scheduledStart && task.scheduledEnd
          ? [{ start: task.scheduledStart, end: task.scheduledEnd }]
          : [],
      ),
      ...events.flatMap((event) =>
        event.taskId && affectedIds.includes(event.taskId)
          ? []
          : [{ start: event.startTime, end: event.endTime }],
      ),
      { start: blockedStart, end: blockedEnd },
    ];

    const result = buildSchedule(
      affectedTasks.map((task) => ({
        id: task.id,
        title: task.title,
        durationMinutes:
          task.estimatedMinutes ??
          (task.scheduledStart && task.scheduledEnd
            ? Math.max(15, Math.round(
                (task.scheduledEnd.getTime() - task.scheduledStart.getTime()) / 60_000,
              ))
            : 30),
        priority: task.priority,
        dueAt: task.dueDate,
        updatedAt: task.updatedAt,
      })),
      occupied,
      planningStart,
      planningEnd,
    );

    const originalByTaskId = new Map(
      affectedTasks.map((task) => [
        task.id,
        {
          start: task.scheduledStart?.toISOString(),
          end: task.scheduledEnd?.toISOString(),
        },
      ]),
    );

    return {
      ...result,
      proposals: result.proposals.map((proposal) => ({
        ...proposal,
        originalStart: originalByTaskId.get(proposal.taskId)?.start,
        originalEnd: originalByTaskId.get(proposal.taskId)?.end,
        reason: `临时冲突后重新安排 · ${proposal.reason}`,
      })),
      affectedTaskIds: affectedIds,
      blockedRange: {
        start: blockedStart.toISOString(),
        end: blockedEnd.toISOString(),
      },
      range: {
        start: planningStart.toISOString(),
        end: planningEnd.toISOString(),
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async apply(
    userId: string,
    data: {
      proposals: ApplyProposal[];
      planningThreadId?: string;
      planningThreadRevision?: number;
      blockedIntervals?: Array<{ start: string; end: string }>;
    },
  ) {
    if (!Array.isArray(data.proposals) || data.proposals.length === 0)
      throw new BadRequestException('No proposals to apply');
    if (data.proposals.length > 50)
      throw new BadRequestException('A plan can contain at most 50 tasks');
    const ids = data.proposals.map((proposal) => proposal.taskId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('A task can only appear once in a plan');

    const blockedIntervals = (data.blockedIntervals || []).slice(0, 5).map((interval) => {
      const start = parseDate(interval.start, 'blockedInterval.start');
      const end = parseDate(interval.end, 'blockedInterval.end');
      if (end <= start)
        throw new BadRequestException('Blocked interval end must be after start');
      return { start, end };
    });

    return this.prisma.$transaction(async (tx) => {
      let planningThreadId: string | null = null;
      let planningThreadRevision: number | null = null;
      let goalScopeId: string | null = null;

      if (data.planningThreadId) {
        const thread = await tx.planningThread.findFirst({
          where: { id: data.planningThreadId, userId },
          select: {
            id: true,
            revision: true,
            status: true,
            scopeType: true,
            scopeId: true,
          },
        });
        if (!thread) throw new NotFoundException('Planning thread not found');
        if (thread.status !== 'active')
          throw new ConflictException('Planning thread is not active');
        if (
          data.planningThreadRevision !== undefined &&
          thread.revision !== data.planningThreadRevision
        ) {
          throw new ConflictException(
            'Planning context changed; generate a new preview',
          );
        }
        planningThreadId = thread.id;
        planningThreadRevision = thread.revision;
        goalScopeId = thread.scopeType === 'goal' ? thread.scopeId : null;
      }

      const tasks = await tx.task.findMany({
        where: {
          userId,
          id: { in: ids },
          ...(goalScopeId
            ? {
                studyFolders: {
                  some: { folderId: goalScopeId },
                },
              }
            : {}),
        },
      });
      if (tasks.length !== ids.length)
        throw new NotFoundException(
          goalScopeId
            ? 'One or more tasks are outside this learning goal'
            : 'One or more tasks were not found',
        );

      const taskMap = new Map(tasks.map((task) => [task.id, task]));
      const proposalIntervals: BusyInterval[] = data.proposals.map(
        (proposal) => {
          const task = taskMap.get(proposal.taskId)!;
          const start = parseDate(proposal.start, 'proposal.start');
          const end = parseDate(proposal.end, 'proposal.end');
          if (end <= start)
            throw new BadRequestException('Proposal end must be after start');
          if (task.scheduleLocked)
            throw new ConflictException(`Task ${task.id} is locked`);
          if (task.updatedAt.toISOString() !== proposal.taskUpdatedAt)
            throw new ConflictException(
              'Plan is stale; generate a new preview',
            );
          if (task.dueDate && end > task.dueDate)
            throw new ConflictException(
              `Task ${task.id} would miss its deadline`,
            );
          return { start, end };
        },
      );
      if (hasOverlap(proposalIntervals))
        throw new ConflictException('Proposed tasks overlap');

      const rangeStart = new Date(
        Math.min(...proposalIntervals.map((item) => item.start.getTime())),
      );
      const rangeEnd = new Date(
        Math.max(...proposalIntervals.map((item) => item.end.getTime())),
      );
      const [fixedTasks, events] = await Promise.all([
        tx.task.findMany({
          where: {
            userId,
            id: { notIn: ids },
            status: { notIn: ['done', 'cancelled'] },
            scheduledStart: { lt: rangeEnd },
            scheduledEnd: { gt: rangeStart },
          },
          select: { scheduledStart: true, scheduledEnd: true },
        }),
        tx.calendarEvent.findMany({
          where: {
            userId,
            startTime: { lt: rangeEnd },
            endTime: { gt: rangeStart },
          },
          select: { startTime: true, endTime: true, taskId: true },
        }),
      ]);
      const occupied: BusyInterval[] = [
        ...fixedTasks.flatMap((task) =>
          task.scheduledStart && task.scheduledEnd
            ? [{ start: task.scheduledStart, end: task.scheduledEnd }]
            : [],
        ),
        ...events.flatMap((event) =>
          event.taskId && ids.includes(event.taskId)
            ? []
            : [{ start: event.startTime, end: event.endTime }],
        ),
        ...blockedIntervals,
      ];
      if (
        proposalIntervals.some((proposal) =>
          occupied.some(
            (item) => proposal.start < item.end && proposal.end > item.start,
          ),
        )
      ) {
        throw new ConflictException('Schedule changed; generate a new preview');
      }

      const beforeState: StoredScheduleState[] = tasks.map((task) => ({
        taskId: task.id,
        scheduledStart: task.scheduledStart?.toISOString() ?? null,
        scheduledEnd: task.scheduledEnd?.toISOString() ?? null,
        estimatedMinutes: task.estimatedMinutes,
        scheduleSource: task.scheduleSource,
      }));
      const afterState: StoredScheduleState[] = [];
      for (const proposal of data.proposals) {
        const updated = await tx.task.update({
          where: { id: proposal.taskId, userId },
          data: {
            scheduledStart: new Date(proposal.start),
            scheduledEnd: new Date(proposal.end),
            estimatedMinutes: proposal.durationMinutes,
            scheduleSource: 'ai',
          },
        });
        afterState.push({
          taskId: updated.id,
          scheduledStart: updated.scheduledStart?.toISOString() ?? null,
          scheduledEnd: updated.scheduledEnd?.toISOString() ?? null,
          estimatedMinutes: updated.estimatedMinutes,
          scheduleSource: updated.scheduleSource,
        });
      }
      const plan = await tx.schedulePlan.create({
        data: {
          userId,
          planningThreadId,
          planningThreadRevision,
          status: 'applied',
          beforeState: beforeState as unknown as Prisma.InputJsonValue,
          afterState: afterState as unknown as Prisma.InputJsonValue,
        },
      });
      return { planId: plan.id, appliedCount: afterState.length };
    });
  }

  async undo(userId: string, planId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.schedulePlan.findFirst({
        where: { id: planId, userId },
      });
      if (!plan) throw new NotFoundException('Schedule plan not found');
      if (plan.status !== 'applied')
        throw new ConflictException('Schedule plan has already been undone');
      const beforeState = readStoredState(plan.beforeState);
      const afterState = readStoredState(plan.afterState);
      const ids = afterState.map((item) => item.taskId);
      const tasks = await tx.task.findMany({
        where: { userId, id: { in: ids } },
      });
      const current = new Map(tasks.map((task) => [task.id, task]));
      for (const expected of afterState) {
        const task = current.get(expected.taskId);
        if (
          !task ||
          !sameInstant(task.scheduledStart, expected.scheduledStart) ||
          !sameInstant(task.scheduledEnd, expected.scheduledEnd)
        ) {
          throw new ConflictException(
            'A planned task changed after apply; undo was cancelled',
          );
        }
      }
      for (const previous of beforeState) {
        await tx.task.update({
          where: { id: previous.taskId, userId },
          data: {
            scheduledStart: previous.scheduledStart
              ? new Date(previous.scheduledStart)
              : null,
            scheduledEnd: previous.scheduledEnd
              ? new Date(previous.scheduledEnd)
              : null,
            estimatedMinutes: previous.estimatedMinutes,
            scheduleSource: previous.scheduleSource,
          },
        });
      }
      await tx.schedulePlan.update({
        where: { id: plan.id },
        data: { status: 'undone' },
      });
      return { planId: plan.id, restoredCount: beforeState.length };
    });
  }
}
