import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  AI_PROVIDER,
  PLANNING_MODELS,
  type AIProvider,
  type PlanningActionProposal,
  type PlanningContextSnapshot,
  type PlanningCourseOccurrenceSnapshot,
  type PlanningCourseSnapshot,
  type PlanningGoalExecutionSnapshot,
  type PlanningModel,
  type PlanningReplanRequest,
  type PlanningSceneSnapshot,
  type PlanningEvidenceItem,
  type PlanningFact,
  type PlanningFactStatus,
  type PlanningHolidayDaySnapshot,
} from '../ai/ai-provider';
import { PrismaService } from '../prisma/prisma.service';
import { WebResearchService } from '../research/web-research.service';
import { CourseIntegrationsService } from '../course/course-integrations.service';
import { templateData } from '../scenes/scene-schema';
import { parseTimeTrackingPreferences } from '../users/time-tracking-preferences';

const SCOPE_TYPES = new Set(['general', 'goal', 'day', 'task', 'course']);
const FACT_STATUSES = new Set<PlanningFactStatus>(['confirmed', 'inferred', 'assumed']);
const PLANNING_MODEL_SET = new Set<PlanningModel>(PLANNING_MODELS);

function yearInTimeZone(date: Date, timeZone: string) {
  try {
    return Number(new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
    }).format(date));
  } catch {
    return date.getUTCFullYear();
  }
}

function normalizeFacts(value: unknown): PlanningFact[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new BadRequestException('Planning context section must be an array');
  if (value.length > 40) throw new BadRequestException('Planning context section is too large');

  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new BadRequestException('Planning fact is invalid');
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.key !== 'string' ||
      typeof candidate.value !== 'string' ||
      typeof candidate.status !== 'string' ||
      !FACT_STATUSES.has(candidate.status as PlanningFactStatus)
    ) {
      throw new BadRequestException('Planning fact is invalid');
    }
    const key = candidate.key.trim();
    const factValue = candidate.value.trim();
    if (!key || !factValue) throw new BadRequestException('Planning fact cannot be empty');
    return {
      key: key.slice(0, 80),
      value: factValue.slice(0, 500),
      status: candidate.status as PlanningFactStatus,
    };
  });
}

function readFacts(value: unknown): PlanningFact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.key !== 'string' ||
      typeof candidate.value !== 'string' ||
      typeof candidate.status !== 'string' ||
      !FACT_STATUSES.has(candidate.status as PlanningFactStatus)
    ) {
      return [];
    }
    return [{
      key: candidate.key,
      value: candidate.value,
      status: candidate.status as PlanningFactStatus,
    }];
  });
}

function contextFromThread(thread: {
  brief: unknown;
  constraints: unknown;
  preferences: unknown;
  strategy: unknown;
  assumptions: unknown;
  revision: number;
}): PlanningContextSnapshot {
  return {
    brief: readFacts(thread.brief),
    constraints: readFacts(thread.constraints),
    preferences: readFacts(thread.preferences),
    strategy: readFacts(thread.strategy),
    assumptions: readFacts(thread.assumptions),
    revision: thread.revision,
  };
}

function json(value: PlanningFact[]): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}
function readEvidence(value: unknown): PlanningEvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const sourceType = candidate.sourceType;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.query !== 'string' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.url !== 'string' ||
      typeof candidate.domain !== 'string' ||
      typeof candidate.snippet !== 'string' ||
      typeof candidate.fetchedAt !== 'string' ||
      typeof candidate.expiresAt !== 'string' ||
      typeof candidate.highImpact !== 'boolean' ||
      !['official', 'primary', 'secondary', 'community', 'unknown'].includes(String(sourceType))
    ) return [];
    return [{
      id: candidate.id,
      query: candidate.query,
      title: candidate.title,
      url: candidate.url,
      domain: candidate.domain,
      snippet: candidate.snippet,
      sourceType: sourceType as PlanningEvidenceItem['sourceType'],
      fetchedAt: candidate.fetchedAt,
      expiresAt: candidate.expiresAt,
      highImpact: candidate.highImpact,
    }];
  });
}

function mergeEvidence(
  existing: PlanningEvidenceItem[],
  incoming: PlanningEvidenceItem[],
): PlanningEvidenceItem[] {
  const byUrl = new Map<string, PlanningEvidenceItem>();
  for (const item of [...existing, ...incoming]) byUrl.set(item.url, item);
  return [...byUrl.values()]
    .sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))
    .slice(0, 30);
}

function freshEvidence(items: PlanningEvidenceItem[], now = new Date()) {
  return items.filter((item) => {
    const expiresAt = new Date(item.expiresAt);
    return !Number.isNaN(expiresAt.getTime()) && expiresAt > now;
  });
}
function readActionProposals(value: unknown): PlanningActionProposal[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.proposalId !== 'string') return [];

    if (candidate.type === 'create_task' && typeof candidate.title === 'string') {
      return [candidate as unknown as PlanningActionProposal];
    }

    if (
      candidate.type === 'update_task' &&
      typeof candidate.taskId === 'string' &&
      candidate.changes &&
      typeof candidate.changes === 'object'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }

    if (
      candidate.type === 'update_goal' &&
      typeof candidate.goalTitle === 'string' &&
      candidate.changes &&
      typeof candidate.changes === 'object'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }

    if (
      candidate.type === 'course_change' &&
      typeof candidate.courseName === 'string' &&
      candidate.change &&
      typeof candidate.change === 'object'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }

    if (
      candidate.type === 'course_template_change' &&
      typeof candidate.courseId === 'string' &&
      typeof candidate.courseName === 'string' &&
      typeof candidate.effectiveFrom === 'string' &&
      candidate.changes &&
      typeof candidate.changes === 'object'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }

    if (
      candidate.type === 'delete_course' &&
      typeof candidate.courseId === 'string' &&
      typeof candidate.courseName === 'string'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }
    if (candidate.type === 'create_scene' && typeof candidate.name === 'string') {
      return [candidate as unknown as PlanningActionProposal];
    }
    if (
      candidate.type === 'update_scene' &&
      typeof candidate.sceneId === 'string' &&
      candidate.changes &&
      typeof candidate.changes === 'object'
    ) {
      return [candidate as unknown as PlanningActionProposal];
    }
    return [];
  });
}

function conversationContextObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}


export function buildGoalExecutionSnapshot(
  tasks: Array<{
    title: string;
    status: string;
    dueDate: Date | null;
    completedAt: Date | null;
    project: string | null;
  }>,
  focusMinutesLast7Days: number,
  now = new Date(),
): PlanningGoalExecutionSnapshot {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const completed = tasks.filter((task) => task.status === 'done');
  const active = tasks.filter((task) => !['done', 'cancelled'].includes(task.status));
  const overdue = active.filter((task) => task.dueDate && task.dueDate < now);
  const recentlyCompleted = completed
    .filter((task) => task.completedAt && task.completedAt >= sevenDaysAgo)
    .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0));

  const milestoneMap = new Map<string, {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
  }>();
  for (const task of tasks) {
    if (task.status === 'cancelled') continue;
    const title = task.project?.trim() || '待整理';
    const current = milestoneMap.get(title) || {
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
    };
    current.totalTasks += 1;
    if (task.status === 'done') current.completedTasks += 1;
    if (!['done', 'cancelled'].includes(task.status) && task.dueDate && task.dueDate < now) {
      current.overdueTasks += 1;
    }
    milestoneMap.set(title, current);
  }

  return {
    totalTasks: tasks.filter((task) => task.status !== 'cancelled').length,
    completedTasks: completed.length,
    activeTasks: active.length,
    overdueTasks: overdue.length,
    completedLast7Days: recentlyCompleted.length,
    focusMinutesLast7Days: Math.max(0, Math.round(focusMinutesLast7Days || 0)),
    recentlyCompletedTitles: recentlyCompleted.slice(0, 5).map((task) => task.title),
    milestones: [...milestoneMap.entries()].map(([title, counts]) => ({
      title,
      ...counts,
    })),
  };
}



@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly research: WebResearchService,
    @Optional() private readonly holidayIntegrations?: CourseIntegrationsService,
  ) {}

  async createThread(
    userId: string,
    data: { title?: string; scopeType?: string; scopeId?: string },
  ) {
    const scopeType = (data.scopeType || 'general').trim().toLowerCase();
    if (!SCOPE_TYPES.has(scopeType)) throw new BadRequestException('Unsupported planning scope');
    const title = data.title?.trim().slice(0, 120) || null;
    const scopeId = data.scopeId?.trim().slice(0, 200) || null;

    if (scopeType === 'goal') {
      if (!scopeId) throw new BadRequestException('Goal planning requires scopeId');
      const ownedGoal = await this.prisma.studyFolder.findFirst({
        where: { id: scopeId, userId, status: 'active' },
        select: { id: true, name: true },
      });
      if (!ownedGoal) throw new NotFoundException('Learning goal not found');

      const existing = await this.prisma.planningThread.findFirst({
        where: {
          userId,
          scopeType: 'goal',
          scopeId,
          status: 'active',
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (existing) return existing;

      return this.prisma.planningThread.create({
        data: {
          userId,
          title: title || ownedGoal.name,
          scopeType,
          scopeId,
        },
      });
    }

    return this.prisma.planningThread.create({
      data: { userId, title, scopeType, scopeId },
    });
  }

  listThreads(
    userId: string,
    status = 'active',
    scopeType?: string,
    scopeId?: string,
  ) {
    const normalizedStatus = status.trim().toLowerCase();
    if (!['active', 'superseded', 'closed'].includes(normalizedStatus)) {
      throw new BadRequestException('Unsupported planning thread status');
    }

    const normalizedScopeType = scopeType?.trim().toLowerCase();
    if (normalizedScopeType && !SCOPE_TYPES.has(normalizedScopeType)) {
      throw new BadRequestException('Unsupported planning scope');
    }

    return this.prisma.planningThread.findMany({
      where: {
        userId,
        status: normalizedStatus,
        ...(normalizedScopeType ? { scopeType: normalizedScopeType } : {}),
        ...(scopeId?.trim() ? { scopeId: scopeId.trim().slice(0, 200) } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { conversations: true, schedulePlans: true } },
      },
    });
  }

  async getThread(userId: string, id: string) {
    const thread = await this.prisma.planningThread.findFirst({
      where: { id, userId },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 12,
        },
        _count: { select: { schedulePlans: true } },
      },
    });
    if (!thread) throw new NotFoundException('Planning thread not found');

    return {
      ...thread,
      conversations: [...thread.conversations].reverse(),
      planningContext: contextFromThread(thread),
    };
  }

  async updateContext(
    userId: string,
    id: string,
    data: {
      expectedRevision: number;
      title?: string | null;
      brief?: unknown;
      constraints?: unknown;
      preferences?: unknown;
      strategy?: unknown;
      assumptions?: unknown;
    },
  ) {
    if (!Number.isInteger(data.expectedRevision) || data.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision is required');
    }

    const existing = await this.prisma.planningThread.findFirst({
      where: { id, userId },
    });
    if (!existing) throw new NotFoundException('Planning thread not found');
    if (existing.status !== 'active') throw new ConflictException('Planning thread is not active');

    const patch: Prisma.PlanningThreadUpdateManyMutationInput = {
      revision: { increment: 1 },
    };
    if (data.title !== undefined) patch.title = data.title?.trim().slice(0, 120) || null;
    if (data.brief !== undefined) patch.brief = json(normalizeFacts(data.brief));
    if (data.constraints !== undefined) patch.constraints = json(normalizeFacts(data.constraints));
    if (data.preferences !== undefined) patch.preferences = json(normalizeFacts(data.preferences));
    if (data.strategy !== undefined) patch.strategy = json(normalizeFacts(data.strategy));
    if (data.assumptions !== undefined) patch.assumptions = json(normalizeFacts(data.assumptions));

    const updated = await this.prisma.planningThread.updateMany({
      where: {
        id,
        userId,
        status: 'active',
        revision: data.expectedRevision,
      },
      data: patch,
    });
    if (updated.count !== 1) {
      throw new ConflictException('Planning context changed; reload before editing');
    }

    return this.getThread(userId, id);
  }

  async turn(
    userId: string,
    id: string,
    data: {
      message: string;
      expectedRevision: number;
      model?: string;
      currentTime?: string;
      timeZone?: string;
    },
  ) {
    const message = data.message?.trim();
    if (!message) throw new BadRequestException('message is required');
    if (message.length > 4000) throw new BadRequestException('message is too long');
    if (!Number.isInteger(data.expectedRevision) || data.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision is required');
    }
    const model = data.model || 'deepseek-v4-flash';
    if (!PLANNING_MODEL_SET.has(model as PlanningModel)) {
      throw new BadRequestException('planning model is invalid');
    }
    const currentTime = data.currentTime ? new Date(data.currentTime) : new Date();
    if (Number.isNaN(currentTime.getTime())) {
      throw new BadRequestException('currentTime is invalid');
    }
    const timeZone = data.timeZone?.trim().slice(0, 100) || 'UTC';

    const thread = await this.prisma.planningThread.findFirst({
      where: { id, userId },
    });
    if (!thread) throw new NotFoundException('Planning thread not found');
    if (thread.status !== 'active') throw new ConflictException('Planning thread is not active');
    if (thread.revision !== data.expectedRevision) {
      throw new ConflictException('Planning context changed; reload before continuing');
    }

    const recentRows = await this.prisma.aIConversation.findMany({
      where: { userId, planningThreadId: id, conversationType: 'planning' },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    const recentMessages = [...recentRows].reverse().flatMap((row) => [
      { role: 'user' as const, content: row.userMessage },
      { role: 'assistant' as const, content: row.aiResponse },
    ]);

    const currentTaskRows = await this.prisma.task.findMany({
      where: {
        userId,
        status: { notIn: ['done', 'cancelled'] },
        ...(thread.scopeType === 'goal' && thread.scopeId
          ? {
              studyFolders: {
                some: { folderId: thread.scopeId },
              },
            }
          : {
              OR: [
                { section: null },
                { section: { not: 'calendar' } },
              ],
            }),
      },
      orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
      take: 80,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        dueDate: true,
        estimatedMinutes: true,
        scheduledStart: true,
        scheduledEnd: true,
        scheduleLocked: true,
        project: true,
        tags: true,
      },
    });
    const currentTasks = currentTaskRows.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString() || null,
      scheduledStart: task.scheduledStart?.toISOString() || null,
      scheduledEnd: task.scheduledEnd?.toISOString() || null,
    }));
    const tagDelegate = (this.prisma as PrismaService & {
      tag?: { findMany: (args: unknown) => Promise<Array<{ name: string }>> };
    }).tag;
    const tagRows = tagDelegate
      ? await tagDelegate.findMany({
          where: { userId, archived: false },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { name: true },
          take: 120,
        })
      : [];
    const currentTags = [...new Set([
      ...tagRows.map((tag) => tag.name),
      ...currentTasks.flatMap((task) => task.tags),
    ])].slice(0, 120);

    let currentCourses: PlanningCourseSnapshot[] = [];
    let currentCourseOccurrences: PlanningCourseOccurrenceSnapshot[] = [];
    if (thread.scopeType !== 'goal') {
      const courseWhere = {
        userId,
        ...(thread.scopeType === 'course' && thread.scopeId
          ? { id: thread.scopeId }
          : {}),
      };
      const occurrenceRangeStart = new Date(currentTime.getTime() - 14 * 24 * 60 * 60 * 1000);
      const occurrenceRangeEnd = new Date(currentTime.getTime() + 90 * 24 * 60 * 60 * 1000);

      const [courseRows, occurrenceRows] = await Promise.all([
        this.prisma.course.findMany({
          where: courseWhere,
          orderBy: { createdAt: 'asc' },
          take: 80,
          select: {
            id: true,
            name: true,
            teacher: true,
            room: true,
            location: true,
            dayOfWeek: true,
            startTime: true,
            endTime: true,
            semesterId: true,
          },
        }),
        this.prisma.calendarEvent.findMany({
          where: {
            userId,
            courseId: { not: null },
            ...(thread.scopeType === 'course' && thread.scopeId
              ? { courseId: thread.scopeId }
              : {}),
            OR: [
              {
                startTime: {
                  gte: occurrenceRangeStart,
                  lt: occurrenceRangeEnd,
                },
              },
              {
                overrideOriginalStart: {
                  gte: occurrenceRangeStart,
                  lt: occurrenceRangeEnd,
                },
              },
            ],
          },
          orderBy: { startTime: 'asc' },
          take: 160,
          include: {
            course: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      currentCourses = courseRows;
      currentCourseOccurrences = occurrenceRows.flatMap((event) => (
        event.courseId && event.course
          ? [{
              id: event.id,
              courseId: event.courseId,
              courseName: event.course.name,
              title: event.title,
              startTime: event.startTime.toISOString(),
              endTime: event.endTime.toISOString(),
              location: event.location || null,
              overrideType: event.overrideType || null,
              overrideOriginalStart: event.overrideOriginalStart?.toISOString() || null,
            }]
          : []
      ));
    }

    const sceneDelegate = (this.prisma as PrismaService & {
      sceneTemplate?: { findMany: (args: unknown) => Promise<PlanningSceneSnapshot[]> };
    }).sceneTemplate;
    const currentSceneRows = sceneDelegate
      ? await sceneDelegate.findMany({
          where: { userId, status: 'active' },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          take: 100,
          select: {
            id: true,
            name: true,
            emoji: true,
            color: true,
            description: true,
            category: true,
            fieldSchema: true,
            triggers: true,
            allowedViews: true,
          },
        })
      : [];
    const currentScenes: PlanningSceneSnapshot[] = currentSceneRows.map((scene) => ({
      ...scene,
      fieldSchema: Array.isArray(scene.fieldSchema) ? scene.fieldSchema : [],
    }));

    let goalExecution: PlanningGoalExecutionSnapshot | undefined;
    if (thread.scopeType === 'goal' && thread.scopeId) {
      const goalTasks = await this.prisma.task.findMany({
        where: {
          userId,
          status: { not: 'cancelled' },
          studyFolders: {
            some: { folderId: thread.scopeId },
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          completedAt: true,
          project: true,
        },
      });
      const sevenDaysAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);
      const focusAggregate = goalTasks.length
        ? await this.prisma.pomodoroSession.aggregate({
            where: {
              userId,
              taskId: { in: goalTasks.map((task) => task.id) },
              status: 'completed',
              endedAt: { gte: sevenDaysAgo },
            },
            _sum: { duration: true },
          })
        : { _sum: { duration: 0 } };

      goalExecution = buildGoalExecutionSnapshot(
        goalTasks,
        focusAggregate._sum.duration || 0,
        currentTime,
      );
    }

    let holidayCalendar: PlanningHolidayDaySnapshot[] = [];
    if (thread.scopeType !== 'goal' && this.holidayIntegrations) {
      const yearAtStart = yearInTimeZone(currentTime, timeZone);
      const horizon = new Date(currentTime.getTime() + 90 * 24 * 60 * 60 * 1000);
      const yearAtEnd = yearInTimeZone(horizon, timeZone);
      const years = [...new Set([yearAtStart, yearAtEnd])].filter(Number.isInteger);
      const calendars = await Promise.all(years.map(async (year) => {
        try {
          return (await this.holidayIntegrations!.holidays(year)).days;
        } catch {
          return [];
        }
      }));
      holidayCalendar = calendars.flat();
    }

    const previousEvidence = freshEvidence(readEvidence(thread.evidence));
    let evidenceUsed = previousEvidence;
    let researchAdded: PlanningEvidenceItem[] = [];
    let researchStatus: 'not-needed' | 'used' | 'unavailable' | 'failed' = 'not-needed';
    let result;

    const planningInputBase = {
      model: model as PlanningModel,
      message,
      context: contextFromThread(thread),
      recentMessages,
      currentTasks,
      currentTags,
      currentCourses,
      currentCourseOccurrences,
      currentScenes,
      holidayCalendar,
      planningScope: {
        type: thread.scopeType,
        id: thread.scopeId,
        title: thread.title,
      },
      goalExecution,
      currentTime: currentTime.toISOString(),
      timeZone,
    };

    try {
      result = await this.ai.generatePlanningTurn({
        ...planningInputBase,
        evidence: previousEvidence,
        researchAllowed: this.research.isConfigured(),
        researchUnavailableReason: this.research.isConfigured()
          ? undefined
          : 'Web research provider is not configured',
      });

      if (result.researchQueries.length > 0) {
        if (!this.research.isConfigured()) {
          researchStatus = 'unavailable';
          result = await this.ai.generatePlanningTurn({
            ...planningInputBase,
            evidence: previousEvidence,
            researchAllowed: false,
            researchUnavailableReason: 'Web research provider is not configured',
          });
        } else {
          try {
            researchAdded = await this.research.research(result.researchQueries);
            evidenceUsed = mergeEvidence(previousEvidence, researchAdded);
            researchStatus = researchAdded.length > 0 ? 'used' : 'failed';
            result = await this.ai.generatePlanningTurn({
              ...planningInputBase,
              evidence: evidenceUsed,
              researchAllowed: false,
              researchUnavailableReason:
                researchAdded.length > 0 ? undefined : 'Search returned no usable evidence',
            });
          } catch {
            researchStatus = 'failed';
            result = await this.ai.generatePlanningTurn({
              ...planningInputBase,
              evidence: previousEvidence,
              researchAllowed: false,
              researchUnavailableReason: 'Web research failed for this turn',
            });
          }
        }
      }
    } catch {
      throw new ServiceUnavailableException('AI planning is temporarily unavailable');
    }

    const validTaskIds = new Set(currentTasks.map((task) => task.id));
    const currentCourseById = new Map(currentCourses.map((course) => [course.id, course]));
    const currentSceneById = new Map(currentScenes.map((scene) => [scene.id, scene]));
    const activeOccurrenceById = new Map(
      currentCourseOccurrences
        .filter((occurrence) => occurrence.overrideType !== 'cancel')
        .map((occurrence) => [occurrence.id, occurrence]),
    );
    const actionProposals: PlanningActionProposal[] = [];
    for (const action of result.actions) {
      if (action.type === 'update_scene') {
        const scene = currentSceneById.get(action.sceneId);
        if (!scene) continue;
        actionProposals.push({
          ...action,
          sceneName: scene.name,
          proposalId: randomUUID(),
        });
        continue;
      }
      if (action.type === 'update_task') {
        if (!validTaskIds.has(action.taskId)) continue;
        const currentTask = currentTasks.find((task) => task.id === action.taskId);
        actionProposals.push({
          ...action,
          taskTitle: currentTask?.title || action.taskTitle,
          proposalId: randomUUID(),
        });
        continue;
      }

      if (action.type === 'update_goal') {
        if (thread.scopeType !== 'goal' || !thread.scopeId) continue;
        actionProposals.push({
          ...action,
          goalTitle: thread.title || action.goalTitle,
          proposalId: randomUUID(),
        });
        continue;
      }

      if (action.type === 'course_template_change') {
        if (thread.scopeType === 'goal') continue;
        const course = currentCourseById.get(action.courseId);
        if (!course) continue;
        actionProposals.push({
          ...action,
          courseName: course.name,
          proposalId: randomUUID(),
        });
        continue;
      }

      if (action.type === 'delete_course') {
        if (thread.scopeType === 'goal') continue;
        const course = currentCourseById.get(action.courseId);
        if (!course) continue;
        actionProposals.push({
          ...action,
          courseName: course.name,
          proposalId: randomUUID(),
        });
        continue;
      }

      if (action.type === 'course_change') {
        if (thread.scopeType === 'goal') continue;

        if (action.change.type === 'extra') {
          const course = currentCourseById.get(action.change.courseId);
          if (!course) continue;
          actionProposals.push({
            ...action,
            courseName: course.name,
            otherCourseName: undefined,
            proposalId: randomUUID(),
          });
          continue;
        }

        const occurrence = activeOccurrenceById.get(action.change.eventId);
        if (!occurrence) continue;

        if (action.change.type === 'swap') {
          const otherOccurrence = activeOccurrenceById.get(action.change.otherEventId);
          if (!otherOccurrence || otherOccurrence.id === occurrence.id) continue;
          actionProposals.push({
            ...action,
            courseName: occurrence.courseName,
            otherCourseName: otherOccurrence.courseName,
            proposalId: randomUUID(),
          });
          continue;
        }

        actionProposals.push({
          ...action,
          courseName: occurrence.courseName,
          otherCourseName: undefined,
          proposalId: randomUUID(),
        });
        continue;
      }

      actionProposals.push({
        ...action,
        proposalId: randomUUID(),
      });
    }

    const replanRequests: PlanningReplanRequest[] = result.replanRequests.map((request) => ({
      ...request,
      requestId: randomUUID(),
    }));

    const requestedCourseActions = result.actions.filter(
      (action) => (
        action.type === 'course_change' ||
        action.type === 'course_template_change' ||
        action.type === 'delete_course'
      ),
    ).length;
    const executableCourseActions = actionProposals.filter(
      (action) => (
        action.type === 'course_change' ||
        action.type === 'course_template_change' ||
        action.type === 'delete_course'
      ),
    ).length;
    let assistantReply = result.reply;
    if (executableCourseActions > 0) {
      assistantReply = `已生成 ${executableCourseActions} 项可执行的课程变动草案，当前日程尚未修改。请在下方检查预览并确认应用；明确回复“确认，全部执行”也可以直接执行。`;
    } else if (requestedCourseActions > 0) {
      assistantReply = '没有生成可安全执行的课程变动草案，当前日程未修改。请重新指定课程和日期，或检查目标课次是否仍然存在。';
    }

    const nextContext = {
      brief: normalizeFacts(result.context.brief),
      constraints: normalizeFacts(result.context.constraints),
      preferences: normalizeFacts(result.context.preferences),
      strategy: normalizeFacts(result.context.strategy),
      assumptions: normalizeFacts(result.context.assumptions),
    };
    const persistedEvidence = mergeEvidence(readEvidence(thread.evidence), researchAdded);

    const transactionResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.planningThread.updateMany({
        where: {
          id,
          userId,
          status: 'active',
          revision: data.expectedRevision,
        },
        data: {
          brief: json(nextContext.brief),
          constraints: json(nextContext.constraints),
          preferences: json(nextContext.preferences),
          strategy: json(nextContext.strategy),
          assumptions: json(nextContext.assumptions),
          evidence: persistedEvidence as unknown as Prisma.InputJsonValue,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException('Planning context changed; reload before continuing');
      }

      const conversation = await tx.aIConversation.create({
        data: {
          userId,
          planningThreadId: id,
          conversationType: 'planning',
          userMessage: message,
          aiResponse: assistantReply,
          context: {
            readiness: result.readiness,
            openQuestions: result.openQuestions,
            summary: result.summary,
            model: this.ai.modelName,
            basedOnRevision: data.expectedRevision,
            researchStatus,
            researchProvider: this.research.providerName,
            evidenceIds: researchAdded.map((item) => item.id),
            actions: actionProposals,
            appliedActionIds: [],
            replanRequests,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      const updatedThread = await tx.planningThread.findFirstOrThrow({ where: { id, userId } });
      return { updatedThread, conversation };
    });

    return {
      threadId: id,
      conversationId: transactionResult.conversation.id,
      revision: transactionResult.updatedThread.revision,
      assistantMessage: assistantReply,
      readiness: result.readiness,
      openQuestions: result.openQuestions,
      summary: result.summary,
      research: {
        status: researchStatus,
        provider: this.research.providerName,
        evidence: researchAdded,
      },
      actions: actionProposals,
      replanRequests,
      planningContext: contextFromThread(transactionResult.updatedThread),
    };
  }

  async applyActions(
    userId: string,
    threadId: string,
    data: { conversationId: string; proposalIds: string[] },
  ) {
    if (!data.conversationId?.trim()) {
      throw new BadRequestException('conversationId is required');
    }
    const requestedIds = [...new Set(
      Array.isArray(data.proposalIds)
        ? data.proposalIds.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
        : [],
    )].slice(0, 60);
    if (!requestedIds.length) throw new BadRequestException('proposalIds are required');

    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: data.conversationId,
        userId,
        planningThreadId: threadId,
        conversationType: 'planning',
      },
      include: {
        planningThread: {
          select: { scopeType: true, scopeId: true },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Planning action proposal not found');

    const context = conversationContextObject(conversation.context);
    const actions = readActionProposals(context.actions);
    const appliedBefore = new Set(
      Array.isArray(context.appliedActionIds)
        ? context.appliedActionIds.filter((value): value is string => typeof value === 'string')
        : [],
    );
    const selected = actions.filter(
      (action) => requestedIds.includes(action.proposalId) && !appliedBefore.has(action.proposalId),
    );
    if (!selected.length) throw new BadRequestException('No unapplied matching action proposals');

    const goalScopeId =
      conversation.planningThread?.scopeType === 'goal'
        ? conversation.planningThread.scopeId
        : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const createdTaskIds: string[] = [];
      const updatedTaskIds: string[] = [];
      const updatedGoalIds: string[] = [];
      const deletedCourseIds: string[] = [];
      const externalActionIds: string[] = [];
      const createdFolderIds: string[] = [];
      const createdSceneIds: string[] = [];
      const updatedSceneIds: string[] = [];
      const scenePlanIds: string[] = [];
      const folderByName = new Map<string, string>();

      const ensureTagMetadata = async (names: string[] = []) => {
        const normalized = [...new Set(names.map((name) => name.replace(/^#+/, '').trim()).filter(Boolean))].slice(0, 12);
        if (!normalized.length) return normalized;
        for (const [index, name] of normalized.entries()) {
          await tx.tag.upsert({
            where: { userId_name: { userId, name } },
            create: { userId, name, sortOrder: index },
            update: { archived: false },
          });
        }
        return normalized;
      };

      const resolveTaskFolder = async (folderName?: string | null) => {
        if (goalScopeId) return goalScopeId;
        const name = folderName?.trim();
        if (!name) return null;
        const cached = folderByName.get(name);
        if (cached) return cached;

        const existingFolder = await tx.studyFolder.findFirst({
          where: { userId, status: 'active', name },
          select: { id: true },
        });
        if (existingFolder) {
          folderByName.set(name, existingFolder.id);
          return existingFolder.id;
        }

        const createdFolder = await tx.studyFolder.create({
          data: {
            userId,
            name,
            description: '由 AI 规划自动归纳创建',
            icon: 'target',
            color: '#cae393',
          },
          select: { id: true },
        });
        folderByName.set(name, createdFolder.id);
        createdFolderIds.push(createdFolder.id);
        return createdFolder.id;
      };

      if (goalScopeId) {
        const ownedGoal = await tx.studyFolder.findFirst({
          where: { id: goalScopeId, userId, status: 'active' },
          select: { id: true },
        });
        if (!ownedGoal) throw new ConflictException('Learning goal is no longer active');
      }

      for (const action of selected) {
        if (action.type === 'create_scene' || action.type === 'update_scene') {
          const sceneInput = action.type === 'create_scene'
            ? {
                name: action.name,
                emoji: action.emoji,
                color: action.color,
                description: action.description,
                category: action.category,
                fieldSchema: action.fieldSchema,
                triggers: action.triggers,
                allowedViews: action.allowedViews,
              }
            : action.changes;
          const before = action.type === 'update_scene'
            ? await tx.sceneTemplate.findFirst({ where: { id: action.sceneId, userId, status: 'active' } })
            : null;
          if (action.type === 'update_scene' && !before) {
            throw new NotFoundException('Scene to update was not found');
          }
          const scene = action.type === 'create_scene'
            ? await tx.sceneTemplate.create({
                data: {
                  ...templateData(sceneInput),
                  id: action.proposalId,
                  name: action.name,
                  userId,
                },
              })
            : await tx.sceneTemplate.update({
                where: { id: action.sceneId, userId },
                data: templateData(sceneInput, true),
              });
          const plan = await tx.schedulePlan.create({
            data: {
              userId,
              planningThreadId: threadId,
              planType: 'scene',
              beforeState: {
                operation: action.type === 'create_scene' ? 'create' : 'update',
                scene: before,
              } as unknown as Prisma.InputJsonValue,
              afterState: {
                operation: action.type === 'create_scene' ? 'create' : 'update',
                scene,
              } as unknown as Prisma.InputJsonValue,
            },
          });
          scenePlanIds.push(plan.id);
          if (action.type === 'create_scene') createdSceneIds.push(scene.id);
          else updatedSceneIds.push(scene.id);
          continue;
        }
        if (action.type === 'delete_course') {
          await tx.calendarEvent.deleteMany({
            where: { userId, courseId: action.courseId },
          });
          const deleted = await tx.course.deleteMany({
            where: { id: action.courseId, userId },
          });
          if (deleted.count !== 1) {
            throw new NotFoundException('Course to delete was not found');
          }
          deletedCourseIds.push(action.courseId);
          continue;
        }

        if (action.type === 'course_change' || action.type === 'course_template_change') {
          // Course data is written only through Course/Template Preview → Apply → Undo.
          // This endpoint only records that the already-applied external proposal
          // is no longer pending in the PlanningThread conversation.
          externalActionIds.push(action.proposalId);
          continue;
        }

        if (action.type === 'update_goal') {
          if (!goalScopeId) {
            throw new BadRequestException('Goal updates require a goal-scoped planning thread');
          }

          const goalPatch: Prisma.StudyFolderUpdateManyMutationInput = {};
          if (action.changes.name !== undefined) goalPatch.name = action.changes.name;
          if (action.changes.description !== undefined) {
            goalPatch.description = action.changes.description;
          }

          const updatedGoal = await tx.studyFolder.updateMany({
            where: { id: goalScopeId, userId, status: 'active' },
            data: goalPatch,
          });
          if (updatedGoal.count !== 1) {
            throw new ConflictException('Learning goal is no longer active');
          }
          if (action.changes.name !== undefined) {
            await tx.planningThread.updateMany({
              where: { id: threadId, userId, scopeType: 'goal', scopeId: goalScopeId },
              data: { title: action.changes.name },
            });
          }
          updatedGoalIds.push(goalScopeId);
          continue;
        }

        if (action.type === 'create_task') {
          const taskFolderId = await resolveTaskFolder(action.folderName);
          const taskTags = await ensureTagMetadata(action.tags);

          await tx.task.createMany({
            data: [{
              id: action.proposalId,
              userId,
              title: action.title,
              description: action.description ?? null,
              status: 'todo',
              priority: action.priority || 'medium',
              section: taskFolderId ? 'study' : 'personal',
              project: taskFolderId ? (action.milestoneTitle || null) : null,
              estimatedMinutes: action.estimatedMinutes ?? null,
              dueDate: action.dueDate ? new Date(action.dueDate) : null,
              scheduledStart: action.scheduledStart ? new Date(action.scheduledStart) : null,
              scheduledEnd: action.scheduledEnd ? new Date(action.scheduledEnd) : null,
              scheduleSource: 'ai',
              tags: taskTags,
            }],
            skipDuplicates: true,
          });
          const task = await tx.task.findFirst({
            where: { id: action.proposalId, userId },
            select: { id: true },
          });
          if (!task) throw new ConflictException('Task proposal id is already in use');

          if (taskFolderId) {
            await tx.studyFolderTask.createMany({
              data: [{ folderId: taskFolderId, taskId: task.id }],
              skipDuplicates: true,
            });
          }

          createdTaskIds.push(task.id);
          continue;
        }

        const changes: Prisma.TaskUpdateManyMutationInput = {};
        if (action.changes.title !== undefined) changes.title = action.changes.title;
        if (action.changes.description !== undefined) changes.description = action.changes.description;
        if (action.changes.priority !== undefined) changes.priority = action.changes.priority;
        if (action.changes.estimatedMinutes !== undefined) changes.estimatedMinutes = action.changes.estimatedMinutes;
        if (action.changes.dueDate !== undefined) {
          changes.dueDate = action.changes.dueDate ? new Date(action.changes.dueDate) : null;
        }
        if (action.changes.scheduledStart !== undefined) {
          changes.scheduledStart = action.changes.scheduledStart
            ? new Date(action.changes.scheduledStart)
            : null;
        }
        if (action.changes.scheduledEnd !== undefined) {
          changes.scheduledEnd = action.changes.scheduledEnd
            ? new Date(action.changes.scheduledEnd)
            : null;
        }
        if (action.changes.tags !== undefined) changes.tags = await ensureTagMetadata(action.changes.tags);
        if ((goalScopeId || action.changes.folderName) && action.changes.milestoneTitle !== undefined) {
          changes.project = action.changes.milestoneTitle || null;
        }

        const updated = await tx.task.updateMany({
          where: {
            id: action.taskId,
            userId,
            ...(goalScopeId
              ? { studyFolders: { some: { folderId: goalScopeId } } }
              : {}),
          },
          data: changes,
        });
        if (updated.count !== 1) throw new NotFoundException('Task to update was not found');
        const targetFolderId = action.changes.folderName
          ? await resolveTaskFolder(action.changes.folderName)
          : null;
        if (targetFolderId) {
          await tx.studyFolderTask.createMany({
            data: [{ folderId: targetFolderId, taskId: action.taskId }],
            skipDuplicates: true,
          });
        }
        updatedTaskIds.push(action.taskId);
      }

      const allApplied = [...new Set([
        ...appliedBefore,
        ...selected.map((action) => action.proposalId),
      ])];
      await tx.aIConversation.update({
        where: { id: conversation.id },
        data: {
          context: {
            ...context,
            appliedActionIds: allApplied,
          } as Prisma.InputJsonValue,
        },
      });

      return {
        appliedActionIds: selected.map((action) => action.proposalId),
        createdTaskIds,
        updatedTaskIds,
        updatedGoalIds: [...new Set(updatedGoalIds)],
        deletedCourseIds,
        createdFolderIds,
        externalActionIds,
        createdSceneIds,
        updatedSceneIds,
        scenePlanIds,
      };
    });

    return result;
  }

  async undoSceneAction(userId: string, threadId: string, planId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.schedulePlan.findFirst({
        where: { id: planId, userId, planningThreadId: threadId, planType: 'scene' },
      });
      if (!plan) throw new NotFoundException('Scene change plan not found');
      if (plan.status === 'undone') throw new ConflictException('Scene change has already been undone');
      const before = plan.beforeState as { operation?: string; scene?: Record<string, unknown> | null };
      const after = plan.afterState as { operation?: string; scene?: Record<string, unknown> | null };
      const afterScene = after.scene;
      if (!afterScene || typeof afterScene.id !== 'string' || typeof afterScene.updatedAt !== 'string') {
        throw new ConflictException('Scene change snapshot is invalid');
      }
      const current = await tx.sceneTemplate.findFirst({ where: { id: afterScene.id, userId } });
      if (!current || current.updatedAt.toISOString() !== afterScene.updatedAt) {
        throw new ConflictException('Scene changed after apply; undo was cancelled');
      }
      if (after.operation === 'create') {
        const entries = await tx.sceneEntry.count({ where: { sceneId: current.id, userId } });
        if (entries > 0) throw new ConflictException('Scene already contains records; undo was cancelled');
        const user = await tx.user.findUnique({ where: { id: userId }, select: { settings: true } });
        if (parseTimeTrackingPreferences(user?.settings).defaultSceneId === current.id) {
          throw new ConflictException('Scene is the current default; choose another default before undo');
        }
        await tx.sceneTemplate.delete({ where: { id: current.id, userId } });
      } else {
        const scene = before.scene;
        if (!scene) throw new ConflictException('Scene change snapshot is invalid');
        await tx.sceneTemplate.update({
          where: { id: current.id, userId },
          data: {
            name: scene.name as string,
            emoji: scene.emoji as string,
            color: scene.color as string,
            description: scene.description as string | null,
            category: scene.category as string | null,
            status: scene.status as string,
            sortOrder: scene.sortOrder as number,
            fieldSchema: scene.fieldSchema as Prisma.InputJsonValue,
            triggers: scene.triggers as string[],
            allowedViews: scene.allowedViews as string[],
          },
        });
      }
      await tx.schedulePlan.update({ where: { id: plan.id }, data: { status: 'undone' } });
      return { planId: plan.id, sceneId: current.id, operation: after.operation };
    });
  }

  async closeThread(userId: string, id: string) {
    const result = await this.prisma.planningThread.updateMany({
      where: { id, userId, status: 'active' },
      data: { status: 'closed', revision: { increment: 1 } },
    });
    if (result.count !== 1) throw new NotFoundException('Active planning thread not found');
    return { id, status: 'closed' };
  }
}
