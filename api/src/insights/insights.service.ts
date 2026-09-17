import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AI_PROVIDER, type AIProvider, type GeneratedInsight, type InsightType } from '../ai/ai-provider';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_TYPES = new Set<InsightType>(['theme', 'evolution', 'action']);
const ALLOWED_STATUSES = new Set(['active', 'archived']);

const sourceInclude = {
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

@Injectable()
export class InsightsService {
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

  async generate(userId: string, data: { days?: number } = {}) {
    const days = Math.min(Math.max(Number(data.days) || 30, 7), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prisma.inspiration.findMany({
      where: {
        userId,
        status: 'active',
        createdAt: { gte: since },
      },
      include: {
        reflections: {
          select: { body: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
          take: 8,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    if (records.length < 2) {
      throw new BadRequestException('至少需要 2 条近期记录才能发现洞察');
    }

    let generated: GeneratedInsight[];
    try {
      generated = await this.ai.generateInsights({
        records: records.map((record) => ({
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
    } catch {
      throw new ServiceUnavailableException('AI 洞察暂时不可用，请稍后再试');
    }

    const allowedSourceIds = new Set(records.map((record) => record.id));
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
        sources: {
          create: item.sourceIds.map((inspirationId) => ({ inspirationId })),
        },
      },
      include: sourceInclude,
    })));
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
