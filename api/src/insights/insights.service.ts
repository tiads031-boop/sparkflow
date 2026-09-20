import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AI_PROVIDER, type AIProvider, type GeneratedInsight, type InsightType } from '../ai/ai-provider';
import { PrismaService } from '../prisma/prisma.service';
import {
  mergeInsightScheduleSettings,
  normalizeInsightSchedulePatch,
  parseInsightSchedule,
  resolveInsightScheduleWindow,
  type InsightSchedulePreferences,
} from './insight-schedule';

const ALLOWED_TYPES = new Set<InsightType>(['theme', 'evolution', 'action']);
const ALLOWED_STATUSES = new Set(['active', 'archived']);

const sourceInclude = {
  tasks: {
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
      estimatedMinutes: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  sources: {
    include: {
      inspiration: {
        select: {
          id: true,
          title: true,
          description: true,
          contentText: true,
          sourceType: true,
          tags: true,
          createdAt: true,
        },
      },
    },
    orderBy: { inspiration: { createdAt: 'asc' as const } },
  },
};

interface GenerationWindow {
  periodStart: Date;
  periodEnd: Date;
  generationRunId?: string;
}

@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  findAll(userId: string, requestedStatus?: string) {
    const status = requestedStatus || 'active';
    if (!ALLOWED_STATUSES.has(status)) throw new BadRequestException('Unsupported insight status');
    return this.prisma.insight.findMany({
      where: { userId, status },
      include: sourceInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const insight = await this.prisma.insight.findFirst({
      where: { id, userId },
      include: sourceInclude,
    });
    if (!insight) throw new NotFoundException('Insight not found');
    return insight;
  }

  async getSchedule(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return parseInsightSchedule(user.settings);
  }

  async updateSchedule(
    userId: string,
    patch: Partial<InsightSchedulePreferences>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const current = parseInsightSchedule(user.settings);
    const next = normalizeInsightSchedulePatch(current, patch);
    await this.prisma.user.update({
      where: { id: userId },
      data: { settings: mergeInsightScheduleSettings(user.settings, next) },
    });
    return next;
  }

  listRuns(userId: string) {
    return this.prisma.insightGenerationRun.findMany({
      where: { userId },
      include: {
        insights: {
          select: { id: true, title: true, type: true, status: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 24,
    });
  }

  async generate(userId: string, data: { days?: number } = {}) {
    const days = Math.min(Math.max(Number(data.days) || 30, 7), 30);
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - days * 86_400_000);
    return this.generateForWindow(userId, { periodStart, periodEnd });
  }

  private async loadCandidates(userId: string, window: GenerationWindow) {
    return this.prisma.inspiration.findMany({
      where: {
        userId,
        status: 'active',
        OR: [
          {
            createdAt: {
              gte: window.periodStart,
              lt: window.periodEnd,
            },
          },
          {
            reflections: {
              some: {
                createdAt: {
                  gte: window.periodStart,
                  lt: window.periodEnd,
                },
              },
            },
          },
        ],
      },
      include: {
        reflections: {
          where: {
            createdAt: {
              gte: window.periodStart,
              lt: window.periodEnd,
            },
          },
          select: { body: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 160,
    });
  }

  private async generateForWindow(userId: string, window: GenerationWindow) {
    const records = await this.loadCandidates(userId, window);
    const textRecords = records.filter((record) => (
      Boolean(record.title?.trim())
      || Boolean(record.description?.trim())
      || Boolean(record.contentText?.trim())
      || record.reflections.some((reflection) => Boolean(reflection.body?.trim()))
    ));

    if (textRecords.length < 2) {
      if (window.generationRunId) return [];
      throw new BadRequestException('至少需要 2 条包含文字的近期记录才能发现洞察');
    }

    let generated: GeneratedInsight[];
    try {
      generated = await this.ai.generateInsights({
        records: textRecords.map((record) => ({
          id: record.id,
          title: record.title,
          description: record.description,
          contentText: record.contentText,
          tags: record.tags,
          createdAt: record.createdAt.toISOString(),
          reflections: record.reflections.map((reflection) => ({
            body: reflection.body,
            createdAt: reflection.createdAt.toISOString(),
          })),
        })),
      });
    } catch (error) {
      const detail = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown provider error';
      this.logger.warn(`AI insight generation failed: ${detail}`);
      throw new ServiceUnavailableException('AI 洞察暂时不可用，请稍后再试');
    }

    const allowedSourceIds = new Set(textRecords.map((record) => record.id));
    const valid = generated.slice(0, 6).flatMap((item) => {
      const title = item.title?.trim();
      const body = item.body?.trim();
      const sourceIds = [...new Set(item.sourceIds || [])];
      const sourcesAreValid = sourceIds.length >= 2
        && sourceIds.every((sourceId) => allowedSourceIds.has(sourceId));
      if (!title || !body || !ALLOWED_TYPES.has(item.type) || !sourcesAreValid) return [];
      return [{ ...item, title: title.slice(0, 160), body, sourceIds }];
    });

    if (valid.length === 0) return [];

    return this.prisma.$transaction(valid.map((item) => this.prisma.insight.create({
      data: {
        userId,
        title: item.title,
        body: item.body,
        type: item.type,
        aiModel: this.ai.modelName,
        generationRunId: window.generationRunId,
        sources: {
          create: item.sourceIds.map((inspirationId) => ({ inspirationId })),
        },
      },
      include: sourceInclude,
    })));
  }

  @Cron('*/15 * * * *')
  async enqueueAndProcessScheduledRuns() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      select: { id: true, settings: true },
    });

    for (const user of users) {
      const schedule = parseInsightSchedule(user.settings, now);
      const window = resolveInsightScheduleWindow(now, schedule);
      if (!window) continue;
      const existing = await this.prisma.insightGenerationRun.findUnique({
        where: {
          userId_runKey: {
            userId: user.id,
            runKey: window.runKey,
          },
        },
        select: { id: true },
      });
      if (existing) continue;
      try {
        await this.prisma.insightGenerationRun.create({
          data: {
            userId: user.id,
            runKey: window.runKey,
            trigger: 'automatic',
            cadence: schedule.cadence,
            timeZone: schedule.timeZone,
            periodStart: window.periodStart,
            periodEnd: window.periodEnd,
            scheduledFor: window.scheduledFor,
          },
        });
      } catch {
        // The unique user/run key handles another scheduler instance winning.
      }
    }

    const queued = await this.prisma.insightGenerationRun.findMany({
      where: {
        status: 'queued',
        scheduledFor: { lte: now },
      },
      select: { id: true },
      orderBy: { scheduledFor: 'asc' },
      take: 12,
    });
    for (const run of queued) {
      await this.processRun(run.id).catch((error) => {
        this.logger.warn(`Periodic insight run ${run.id.slice(0, 8)} failed: ${error instanceof Error ? error.message : 'unknown'}`);
      });
    }
  }

  private async processRun(id: string, userId?: string) {
    const run = await this.prisma.insightGenerationRun.findFirst({
      where: { id, ...(userId ? { userId } : {}) },
    });
    if (!run) throw new NotFoundException('Insight run not found');
    if (run.status === 'completed') return run;

    const claimed = await this.prisma.insightGenerationRun.updateMany({
      where: {
        id: run.id,
        status: { in: ['queued', 'failed', 'skipped'] },
      },
      data: {
        status: 'running',
        startedAt: new Date(),
        completedAt: null,
        errorMessage: null,
      },
    });
    if (claimed.count !== 1) {
      return this.prisma.insightGenerationRun.findUnique({ where: { id: run.id } });
    }

    try {
      const records = await this.loadCandidates(run.userId, {
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
      });
      const created = await this.generateForWindow(run.userId, {
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        generationRunId: run.id,
      });
      return this.prisma.insightGenerationRun.update({
        where: { id: run.id },
        data: {
          status: created.length > 0 ? 'completed' : 'skipped',
          sourceCount: records.length,
          insightCount: created.length,
          completedAt: new Date(),
        },
        include: {
          insights: {
            select: { id: true, title: true, type: true, status: true },
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : 'unknown generation error';
      await this.prisma.insightGenerationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorMessage: message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async retryRun(id: string, userId: string) {
    const run = await this.prisma.insightGenerationRun.findFirst({
      where: { id, userId },
    });
    if (!run) throw new NotFoundException('Insight run not found');
    if (!['failed', 'skipped'].includes(run.status)) {
      throw new BadRequestException('只有失败或无内容的周期可以重试');
    }
    await this.prisma.insightGenerationRun.update({
      where: { id },
      data: {
        status: 'queued',
        retryCount: { increment: 1 },
        errorMessage: null,
        completedAt: null,
      },
    });
    return this.processRun(id, userId);
  }

  async regenerateRun(id: string, userId: string) {
    const run = await this.prisma.insightGenerationRun.findFirst({
      where: { id, userId },
    });
    if (!run) throw new NotFoundException('Insight run not found');
    const regenerated = await this.prisma.insightGenerationRun.create({
      data: {
        userId,
        runKey: `${run.runKey}:regenerate:${Date.now()}`,
        trigger: 'regenerate',
        cadence: run.cadence,
        timeZone: run.timeZone,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        scheduledFor: new Date(),
      },
    });
    return this.processRun(regenerated.id, userId);
  }

  async updateStatus(id: string, userId: string, status: string) {
    if (!ALLOWED_STATUSES.has(status)) throw new BadRequestException('Unsupported insight status');
    const existing = await this.prisma.insight.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Insight not found');
    return this.prisma.insight.update({
      where: { id },
      data: { status },
      include: sourceInclude,
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.insight.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Insight not found');
    return this.prisma.insight.delete({ where: { id } });
  }
}
