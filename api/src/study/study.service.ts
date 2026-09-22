import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { overlapSeconds } from '../analytics/analytics-time';
import type {
  GoalProgressEntryInput,
  StudyFolderInput,
} from './study.controller';

const progressTypes = new Set(['task', 'numeric', 'time']);

type ProgressSettingsPatch = {
  progressType?: string;
  targetValue?: number | null;
  progressUnit?: string | null;
};

type ProgressSession = {
  startedAt: Date;
  endedAt: Date | null;
  effectiveDurationSeconds: number;
  segments: Array<{ startedAt: Date; endedAt: Date | null }>;
};

const folderInclude = {
  courses: { include: { course: true } },
  tasks: { include: { task: true } },
} as const;

type FolderWithRelations = Prisma.StudyFolderGetPayload<{
  include: typeof folderInclude;
}>;

@Injectable()
export class StudyService {
  constructor(private prisma: PrismaService) {}

  private normalizeIds(ids?: string[]) {
    return ids === undefined ? undefined : [...new Set(ids.filter(Boolean))];
  }

  private normalizeName(name: string | undefined) {
    const value = name?.trim() || '';
    if (!value) throw new BadRequestException('学习文件夹名称不能为空');
    if (value.length > 60)
      throw new BadRequestException('学习文件夹名称不能超过 60 个字符');
    return value;
  }

  private progressSettings(
    input: StudyFolderInput,
    current?: {
      progressType: string;
      targetValue: number | null;
      progressUnit: string | null;
    },
  ): ProgressSettingsPatch {
    const touched =
      input.progressType !== undefined ||
      input.targetValue !== undefined ||
      input.progressUnit !== undefined;
    if (!touched) return {};
    const progressType = input.progressType ?? current?.progressType ?? 'task';
    if (!progressTypes.has(progressType)) {
      throw new BadRequestException('进度类型无效');
    }
    if (progressType === 'task') {
      return { progressType, targetValue: null, progressUnit: null };
    }
    const rawTarget =
      input.targetValue !== undefined
        ? input.targetValue
        : (current?.targetValue ?? null);
    if (
      rawTarget !== null &&
      (typeof rawTarget !== 'number' ||
        !Number.isFinite(rawTarget) ||
        rawTarget <= 0 ||
        rawTarget > 1_000_000_000_000)
    )
      throw new BadRequestException('目标值必须是有效的正数');
    const rawUnit =
      progressType === 'time'
        ? '分钟'
        : input.progressUnit !== undefined
          ? input.progressUnit
          : (current?.progressUnit ?? '项');
    if (rawUnit !== null && typeof rawUnit !== 'string') {
      throw new BadRequestException('进度单位无效');
    }
    const progressUnit =
      rawUnit?.trim() || (progressType === 'numeric' ? '项' : '分钟');
    if (progressUnit.length > 30)
      throw new BadRequestException('进度单位不能超过 30 个字符');
    return { progressType, targetValue: rawTarget, progressUnit };
  }

  private progressEntryData(input: GoalProgressEntryInput, partial = false) {
    const data: { value?: number; occurredAt?: Date; note?: string | null } =
      {};
    if (!partial || input.value !== undefined) {
      if (
        typeof input.value !== 'number' ||
        !Number.isFinite(input.value) ||
        input.value === 0 ||
        Math.abs(input.value) > 1_000_000_000_000
      )
        throw new BadRequestException('进度变化必须是有效的非零数值');
      data.value = input.value;
    }
    if (input.occurredAt !== undefined) {
      if (typeof input.occurredAt !== 'string' || !input.occurredAt) {
        throw new BadRequestException('进度时间无效');
      }
      const occurredAt = new Date(input.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new BadRequestException('进度时间无效');
      }
      data.occurredAt = occurredAt;
    }
    if (input.note !== undefined) {
      if (input.note !== null && typeof input.note !== 'string') {
        throw new BadRequestException('进度备注无效');
      }
      const note = input.note?.trim() || null;
      if (note && note.length > 500)
        throw new BadRequestException('进度备注不能超过 500 个字符');
      data.note = note;
    }
    if (partial && !Object.keys(data).length) {
      throw new BadRequestException('没有可更新的进度字段');
    }
    return data;
  }

  private async progressGoal(id: string, userId: string, activeOnly = false) {
    const goal = await this.prisma.studyFolder.findFirst({
      where: { id, userId, ...(activeOnly ? { status: 'active' } : {}) },
      select: {
        id: true,
        status: true,
        progressType: true,
        targetValue: true,
        progressUnit: true,
      },
    });
    if (!goal) throw new NotFoundException('学习目标不存在');
    return goal;
  }

  private progressRange(weekStart?: string, weekEnd?: string) {
    if (Boolean(weekStart) !== Boolean(weekEnd)) {
      throw new BadRequestException('weekStart 和 weekEnd 必须同时提供');
    }
    const end = weekEnd ? new Date(weekEnd) : new Date();
    const start = weekStart
      ? new Date(weekStart)
      : new Date(end.getTime() - 7 * 86_400_000);
    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start ||
      end.getTime() - start.getTime() > 8 * 86_400_000
    )
      throw new BadRequestException('本周时间范围无效');
    return { start, end };
  }

  private percent(current: number, target: number | null) {
    if (!target || target <= 0) return null;
    return Math.round((current / target) * 1000) / 10;
  }

  private async validateLinks(
    userId: string,
    courseIds?: string[],
    taskIds?: string[],
  ) {
    const courses = this.normalizeIds(courseIds);
    const tasks = this.normalizeIds(taskIds);
    const [ownedCourses, ownedTasks] = await Promise.all([
      courses === undefined
        ? undefined
        : this.prisma.course.findMany({
            where: { userId, id: { in: courses } },
            select: { id: true },
          }),
      tasks === undefined
        ? undefined
        : this.prisma.task.findMany({
            where: { userId, id: { in: tasks } },
            select: { id: true },
          }),
    ]);
    if (courses && ownedCourses?.length !== courses.length) {
      throw new BadRequestException('包含无权关联的课程');
    }
    if (tasks && ownedTasks?.length !== tasks.length) {
      throw new BadRequestException('包含无权关联的任务');
    }
    return { courseIds: courses, taskIds: tasks };
  }

  private present(
    folder: FolderWithRelations,
    planningThread?: {
      id: string;
      revision: number;
      updatedAt: Date;
      _count: { conversations: number; schedulePlans: number };
    } | null,
  ) {
    const { courses, tasks, ...attributes } = folder;
    return {
      ...attributes,
      courses: courses.map((link) => link.course),
      tasks: tasks.map((link) => link.task),
      planningThread: planningThread
        ? {
            id: planningThread.id,
            revision: planningThread.revision,
            updatedAt: planningThread.updatedAt,
            conversationCount: planningThread._count.conversations,
            schedulePlanCount: planningThread._count.schedulePlans,
          }
        : null,
    };
  }

  async findAll(userId: string, status = 'active') {
    const folders = await this.prisma.studyFolder.findMany({
      where: { userId, ...(status === 'all' ? {} : { status }) },
      include: folderInclude,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });

    const goalIds = folders.map((folder) => folder.id);
    const threads = goalIds.length
      ? await this.prisma.planningThread.findMany({
          where: {
            userId,
            scopeType: 'goal',
            scopeId: { in: goalIds },
            status: 'active',
          },
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: { select: { conversations: true, schedulePlans: true } },
          },
        })
      : [];
    const threadByGoalId = new Map<string, (typeof threads)[number]>();
    for (const thread of threads) {
      if (thread.scopeId && !threadByGoalId.has(thread.scopeId)) {
        threadByGoalId.set(thread.scopeId, thread);
      }
    }

    return folders.map((folder) =>
      this.present(folder, threadByGoalId.get(folder.id) || null),
    );
  }

  async findOne(id: string, userId: string) {
    const folder = await this.prisma.studyFolder.findFirst({
      where: { id, userId },
      include: folderInclude,
    });
    if (!folder) throw new NotFoundException('学习目标不存在');

    const planningThread = await this.prisma.planningThread.findFirst({
      where: {
        userId,
        scopeType: 'goal',
        scopeId: id,
        status: 'active',
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { conversations: true, schedulePlans: true } },
      },
    });

    return this.present(folder, planningThread);
  }

  async create(userId: string, input: StudyFolderInput) {
    const name = this.normalizeName(input.name);
    const { courseIds = [], taskIds = [] } = await this.validateLinks(
      userId,
      input.courseIds || [],
      input.taskIds || [],
    );
    const folder = await this.prisma.studyFolder.create({
      data: {
        userId,
        name,
        description: input.description?.trim() || null,
        icon: input.icon?.trim() || 'book-open',
        color: input.color?.trim() || '#cae393',
        ...this.progressSettings(input),
        courses: { create: courseIds.map((courseId) => ({ courseId })) },
        tasks: { create: taskIds.map((taskId) => ({ taskId })) },
      },
      include: folderInclude,
    });
    return this.present(folder);
  }

  async update(id: string, userId: string, input: StudyFolderInput) {
    const existing = await this.findOne(id, userId);
    const { courseIds, taskIds } = await this.validateLinks(
      userId,
      input.courseIds,
      input.taskIds,
    );
    const folder = await this.prisma.$transaction(async (tx) => {
      if (courseIds !== undefined) {
        await tx.studyFolderCourse.deleteMany({ where: { folderId: id } });
      }
      if (taskIds !== undefined) {
        await tx.studyFolderTask.deleteMany({ where: { folderId: id } });
      }
      return tx.studyFolder.update({
        where: { id },
        data: {
          ...(input.name !== undefined
            ? { name: this.normalizeName(input.name) }
            : {}),
          ...(input.description !== undefined
            ? { description: input.description?.trim() || null }
            : {}),
          ...(input.icon !== undefined
            ? { icon: input.icon.trim() || 'book-open' }
            : {}),
          ...(input.color !== undefined
            ? { color: input.color.trim() || '#cae393' }
            : {}),
          ...this.progressSettings(input, existing),
          ...(courseIds !== undefined
            ? {
                courses: {
                  create: courseIds.map((courseId) => ({ courseId })),
                },
              }
            : {}),
          ...(taskIds !== undefined
            ? { tasks: { create: taskIds.map((taskId) => ({ taskId })) } }
            : {}),
        },
        include: folderInclude,
      });
    });
    return this.present(folder);
  }

  async setStatus(id: string, userId: string, status: 'active' | 'archived') {
    const folder = await this.prisma.studyFolder.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!folder) throw new NotFoundException('学习目标不存在');
    const updated = await this.prisma.studyFolder.update({
      where: { id },
      data: { status },
      include: folderInclude,
    });
    return this.present(updated);
  }

  async remove(id: string, userId: string) {
    const folder = await this.prisma.studyFolder.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!folder) throw new NotFoundException('学习目标不存在');
    return this.prisma.studyFolder.delete({ where: { id } });
  }

  async progress(
    id: string,
    userId: string,
    weekStart?: string,
    weekEnd?: string,
  ) {
    const { start, end } = this.progressRange(weekStart, weekEnd);
    const goal = await this.prisma.studyFolder.findFirst({
      where: { id, userId },
      select: {
        id: true,
        progressType: true,
        targetValue: true,
        progressUnit: true,
        tasks: { select: { task: { select: { id: true, status: true } } } },
      },
    });
    if (!goal) throw new NotFoundException('学习目标不存在');
    const taskIds = goal.tasks.map((link) => link.task.id);
    const relevantTasks = goal.tasks.filter(
      (link) => link.task.status !== 'cancelled',
    );
    const completedTasks = relevantTasks.filter(
      (link) => link.task.status === 'done',
    ).length;
    const actualWhere: Prisma.PomodoroSessionWhereInput = {
      userId,
      taskId: { in: taskIds },
      countsTowardActual: true,
      status: { in: ['completed', 'interrupted'] },
      effectiveDurationSeconds: { gt: 0 },
    };
    const weekSessionsPromise: Promise<ProgressSession[]> = taskIds.length
      ? this.prisma.pomodoroSession.findMany({
          where: {
            ...actualWhere,
            startedAt: { lt: end },
            endedAt: { gt: start },
          },
          select: {
            startedAt: true,
            endedAt: true,
            effectiveDurationSeconds: true,
            segments: { select: { startedAt: true, endedAt: true } },
          },
        })
      : Promise.resolve([]);
    const [totalActual, weekSessions, numeric, entries] = await Promise.all([
      taskIds.length
        ? this.prisma.pomodoroSession.aggregate({
            where: actualWhere,
            _sum: { effectiveDurationSeconds: true },
          })
        : Promise.resolve({ _sum: { effectiveDurationSeconds: 0 } }),
      weekSessionsPromise,
      this.prisma.goalProgressEntry.aggregate({
        where: { userId, studyFolderId: id },
        _sum: { value: true },
      }),
      this.prisma.goalProgressEntry.findMany({
        where: { userId, studyFolderId: id },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 20,
      }),
    ]);
    const weekSeconds = weekSessions.reduce((sum, session) => {
      if (!session.endedAt) return sum;
      const segmentSeconds = session.segments.reduce(
        (value, segment) =>
          value +
          overlapSeconds(
            segment.startedAt,
            segment.endedAt ?? session.endedAt!,
            start,
            end,
          ),
        0,
      );
      const fallbackSeconds = overlapSeconds(
        session.startedAt,
        session.endedAt,
        start,
        end,
      );
      return (
        sum +
        Math.min(
          session.effectiveDurationSeconds,
          segmentSeconds || fallbackSeconds,
        )
      );
    }, 0);
    const totalMinutes = Math.round(
      (totalActual._sum.effectiveDurationSeconds ?? 0) / 60,
    );
    const weekMinutes = Math.round(weekSeconds / 60);
    const numericValue = numeric._sum.value ?? 0;
    const taskTarget = relevantTasks.length || null;
    const type = progressTypes.has(goal.progressType)
      ? goal.progressType
      : 'task';
    const primary =
      type === 'time'
        ? {
            current: totalMinutes,
            target: goal.targetValue,
            unit: '分钟',
            source: 'actual_time',
          }
        : type === 'numeric'
          ? {
              current: numericValue,
              target: goal.targetValue,
              unit: goal.progressUnit || '项',
              source: 'manual_entries',
            }
          : {
              current: completedTasks,
              target: taskTarget,
              unit: '任务',
              source: 'tasks',
            };
    return {
      goalId: goal.id,
      progressType: type,
      primary: {
        ...primary,
        percent: this.percent(primary.current, primary.target),
      },
      task: {
        completed: completedTasks,
        total: relevantTasks.length,
        percent: this.percent(completedTasks, taskTarget),
      },
      actual: { totalMinutes, weekMinutes, weekStart: start, weekEnd: end },
      numeric: {
        current: numericValue,
        unit: goal.progressUnit || '项',
        entries,
      },
    };
  }

  async createProgressEntry(
    id: string,
    userId: string,
    input: GoalProgressEntryInput,
  ) {
    const goal = await this.progressGoal(id, userId, true);
    if (goal.progressType !== 'numeric') {
      throw new BadRequestException('只有数值型目标可以手工记录进度');
    }
    const entry = this.progressEntryData(input);
    return this.prisma.goalProgressEntry.create({
      data: {
        ...entry,
        value: entry.value!,
        userId,
        studyFolderId: id,
        source: 'manual',
      },
    });
  }

  async updateProgressEntry(
    id: string,
    entryId: string,
    userId: string,
    input: GoalProgressEntryInput,
  ) {
    const goal = await this.progressGoal(id, userId, true);
    if (goal.progressType !== 'numeric') {
      throw new BadRequestException('只有数值型目标可以修改进度');
    }
    const existing = await this.prisma.goalProgressEntry.findFirst({
      where: { id: entryId, studyFolderId: id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('进度记录不存在');
    return this.prisma.goalProgressEntry.update({
      where: { id: entryId },
      data: this.progressEntryData(input, true),
    });
  }

  async deleteProgressEntry(id: string, entryId: string, userId: string) {
    await this.progressGoal(id, userId, true);
    const deleted = await this.prisma.goalProgressEntry.deleteMany({
      where: { id: entryId, studyFolderId: id, userId },
    });
    if (deleted.count !== 1) throw new NotFoundException('进度记录不存在');
    return { id: entryId, deleted: true };
  }
}
