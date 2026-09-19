import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  AI_PROVIDER,
  type AIProvider,
  type PlanningActionProposal,
  type PlanningContextSnapshot,
  type PlanningReplanRequest,
  type PlanningEvidenceItem,
  type PlanningFact,
  type PlanningFactStatus,
} from '../ai/ai-provider';
import { PrismaService } from '../prisma/prisma.service';
import { WebResearchService } from '../research/web-research.service';

const SCOPE_TYPES = new Set(['general', 'goal', 'day', 'task', 'course']);
const FACT_STATUSES = new Set<PlanningFactStatus>(['confirmed', 'inferred', 'assumed']);

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
    return [];
  });
}

function conversationContextObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}



@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly research: WebResearchService,
  ) {}

  async createThread(
    userId: string,
    data: { title?: string; scopeType?: string; scopeId?: string },
  ) {
    const scopeType = (data.scopeType || 'general').trim().toLowerCase();
    if (!SCOPE_TYPES.has(scopeType)) throw new BadRequestException('Unsupported planning scope');
    const scopeId = data.scopeId?.trim().slice(0, 200) || null;
    let title = data.title?.trim().slice(0, 120) || null;

    if (scopeType === 'goal') {
      if (!scopeId) throw new BadRequestException('Goal planning requires scopeId');
      const goal = await this.prisma.studyFolder.findFirst({
        where: { id: scopeId, userId },
        select: { id: true, name: true },
      });
      if (!goal) throw new NotFoundException('Study goal not found');
      title ||= `学习目标 · ${goal.name}`;
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
    const normalizedScopeId = scopeId?.trim() || undefined;

    return this.prisma.planningThread.findMany({
      where: {
        userId,
        status: normalizedStatus,
        ...(normalizedScopeType ? { scopeType: normalizedScopeType } : {}),
        ...(normalizedScopeId ? { scopeId: normalizedScopeId } : {}),
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
        OR: [
          { section: null },
          { section: { not: 'calendar' } },
        ],
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
      },
    });
    const currentTasks = currentTaskRows.map((task) => ({
      ...task,
      dueDate: task.dueDate?.toISOString() || null,
      scheduledStart: task.scheduledStart?.toISOString() || null,
      scheduledEnd: task.scheduledEnd?.toISOString() || null,
    }));

    const previousEvidence = freshEvidence(readEvidence(thread.evidence));
    let evidenceUsed = previousEvidence;
    let researchAdded: PlanningEvidenceItem[] = [];
    let researchStatus: 'not-needed' | 'used' | 'unavailable' | 'failed' = 'not-needed';
    let result;

    try {
      result = await this.ai.generatePlanningTurn({
        message,
        context: contextFromThread(thread),
        recentMessages,
        currentTasks,
        currentTime: currentTime.toISOString(),
        timeZone,
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
            message,
            context: contextFromThread(thread),
            recentMessages,
            currentTasks,
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
              message,
              context: contextFromThread(thread),
              recentMessages,
              currentTasks,
              evidence: evidenceUsed,
              researchAllowed: false,
              researchUnavailableReason:
                researchAdded.length > 0 ? undefined : 'Search returned no usable evidence',
            });
          } catch {
            researchStatus = 'failed';
            result = await this.ai.generatePlanningTurn({
              message,
              context: contextFromThread(thread),
              recentMessages,
              currentTasks,
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
    const actionProposals: PlanningActionProposal[] = [];
    for (const action of result.actions) {
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

      actionProposals.push({
        ...action,
        proposalId: randomUUID(),
      });
    }

    const replanRequests: PlanningReplanRequest[] = result.replanRequests.map((request) => ({
      ...request,
      requestId: randomUUID(),
    }));

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
          aiResponse: result.reply,
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
      assistantMessage: result.reply,
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
    )].slice(0, 8);
    if (!requestedIds.length) throw new BadRequestException('proposalIds are required');

    const conversation = await this.prisma.aIConversation.findFirst({
      where: {
        id: data.conversationId,
        userId,
        planningThreadId: threadId,
        conversationType: 'planning',
      },
    });
    if (!conversation) throw new NotFoundException('Planning action proposal not found');

    const planningThread = await this.prisma.planningThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true, scopeType: true, scopeId: true, status: true },
    });
    if (!planningThread) throw new NotFoundException('Planning thread not found');
    if (planningThread.status !== 'active') {
      throw new ConflictException('Planning thread is not active');
    }

    const goalFolderId =
      planningThread.scopeType === 'goal' && planningThread.scopeId
        ? planningThread.scopeId
        : null;
    if (goalFolderId) {
      const goal = await this.prisma.studyFolder.findFirst({
        where: { id: goalFolderId, userId },
        select: { id: true },
      });
      if (!goal) throw new NotFoundException('Study goal not found');
    }

    const context = conversationContextObject(conversation.context);
    const actions = readActionProposals(context.actions);
    const appliedBefore = new Set(
      Array.isArray(context.appliedActionIds)
        ? context.appliedActionIds.filter((value): value is string => typeof value === 'string')
        : [],
    );
    const selected = actions.filter((action) => requestedIds.includes(action.proposalId));
    if (!selected.length) throw new BadRequestException('No matching action proposals');

    const result = await this.prisma.$transaction(async (tx) => {
      const createdTaskIds: string[] = [];
      const updatedTaskIds: string[] = [];

      for (const action of selected) {
        if (action.type === 'create_task') {
          await tx.task.createMany({
            data: [{
              id: action.proposalId,
              userId,
              title: action.title,
              description: action.description ?? null,
              status: 'todo',
              priority: action.priority || 'medium',
              section: goalFolderId ? 'study' : 'personal',
              estimatedMinutes: action.estimatedMinutes ?? null,
              dueDate: action.dueDate ? new Date(action.dueDate) : null,
              scheduleSource: 'ai',
              tags: [],
            }],
            skipDuplicates: true,
          });
          const task = await tx.task.findFirst({
            where: { id: action.proposalId, userId },
            select: { id: true },
          });
          if (!task) throw new ConflictException('Task proposal id is already in use');
          if (goalFolderId) {
            await tx.studyFolderTask.createMany({
              data: [{ folderId: goalFolderId, taskId: task.id }],
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

        const updated = await tx.task.updateMany({
          where: { id: action.taskId, userId },
          data: changes,
        });
        if (updated.count !== 1) throw new NotFoundException('Task to update was not found');
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
      };
    });

    return result;
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
