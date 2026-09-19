import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  AI_PROVIDER,
  type AIProvider,
  type PlanningContextSnapshot,
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
    const title = data.title?.trim().slice(0, 120) || null;
    const scopeId = data.scopeId?.trim().slice(0, 200) || null;

    return this.prisma.planningThread.create({
      data: { userId, title, scopeType, scopeId },
    });
  }

  listThreads(userId: string, status = 'active') {
    const normalizedStatus = status.trim().toLowerCase();
    if (!['active', 'superseded', 'closed'].includes(normalizedStatus)) {
      throw new BadRequestException('Unsupported planning thread status');
    }
    return this.prisma.planningThread.findMany({
      where: { userId, status: normalizedStatus },
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
    data: { message: string; expectedRevision: number },
  ) {
    const message = data.message?.trim();
    if (!message) throw new BadRequestException('message is required');
    if (message.length > 4000) throw new BadRequestException('message is too long');
    if (!Number.isInteger(data.expectedRevision) || data.expectedRevision < 1) {
      throw new BadRequestException('expectedRevision is required');
    }

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

    const nextContext = {
      brief: normalizeFacts(result.context.brief),
      constraints: normalizeFacts(result.context.constraints),
      preferences: normalizeFacts(result.context.preferences),
      strategy: normalizeFacts(result.context.strategy),
      assumptions: normalizeFacts(result.context.assumptions),
    };
    const persistedEvidence = mergeEvidence(readEvidence(thread.evidence), researchAdded);

    const updatedThread = await this.prisma.$transaction(async (tx) => {
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

      await tx.aIConversation.create({
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
          } as Prisma.InputJsonValue,
        },
      });

      return tx.planningThread.findFirstOrThrow({ where: { id, userId } });
    });

    return {
      threadId: id,
      revision: updatedThread.revision,
      assistantMessage: result.reply,
      readiness: result.readiness,
      openQuestions: result.openQuestions,
      summary: result.summary,
      research: {
        status: researchStatus,
        provider: this.research.providerName,
        evidence: researchAdded,
      },
      planningContext: contextFromThread(updatedThread),
    };
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
