import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';
import { InspirationMediaService } from './inspiration-media.service';
import { VoiceTranscriptionService } from '../planning/voice-transcription.service';
import { AI_PROVIDER, type AIProvider } from '../ai/ai-provider';
import { MediaUnderstandingService } from './media-understanding.service';

const attachmentList = {
  select: {
    id: true,
    inspirationId: true,
    kind: true,
    mimeType: true,
    originalName: true,
    sizeBytes: true,
    transcript: true,
    aiSummary: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'asc' as const },
};

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class InspirationsService {
  constructor(
    private prisma: PrismaService,
    private readonly media: InspirationMediaService,
    private readonly voice: VoiceTranscriptionService,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    private readonly mediaAI: MediaUnderstandingService,
  ) {}

  findAll(userId: string, status?: string) {
    return this.prisma.inspiration.findMany({
      where: { userId, ...(status && { status }) },
      include: {
        _count: { select: { reflections: true } },
        task: { select: { id: true, title: true, status: true } },
        attachments: attachmentList,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.inspiration.findFirst({
      where: { id, userId },
      include: {
        reflections: { orderBy: { createdAt: 'desc' } },
        task: { select: { id: true, title: true, status: true } },
        attachments: attachmentList,
      },
    });
  }

  create(data: {
    userId: string;
    sourceUrl?: string | null;
    sourceType?: string;
    title?: string;
    description?: string;
    contentText?: string;
    coverImage?: string;
    author?: string;
    tags?: string[];
  }) {
    const title = data.title?.trim();
    const description = data.description?.trim();
    const contentText = data.contentText?.trim();
    if (!title && !description && !contentText) {
      throw new BadRequestException('记录内容不能为空');
    }

    const now = new Date();
    return this.prisma.inspiration.create({
      data: {
        ...data,
        title: title || null,
        description: description || null,
        contentText: contentText || null,
        sourceUrl: data.sourceUrl?.trim() || null,
        sourceType: data.sourceType || 'manual',
        tags: data.tags ?? [],
        nextReviewAt: addDays(now, 1),
      },
      include: {
        _count: { select: { reflections: true } },
        task: { select: { id: true, title: true, status: true } },
        attachments: attachmentList,
      },
    });
  }

  async createCapture(
    userId: string,
    contentText: string | undefined,
    files: Express.Multer.File[] = [],
    tags: string[] = [],
  ) {
    const normalizedText = contentText?.trim() || '';
    if (!normalizedText && !files.length) {
      throw new BadRequestException('请填写文字或添加至少一个附件');
    }

    const id = randomUUID();
    const stored = await this.media.persist(id, files);
    try {
      const now = new Date();
      return await this.prisma.inspiration.create({
        data: {
          id,
          userId,
          sourceType: 'manual',
          contentText: normalizedText || null,
          tags,
          nextReviewAt: addDays(now, 1),
          attachments: stored.length
            ? {
                create: stored.map((item) => ({
                  id: item.id,
                  kind: item.kind,
                  mimeType: item.mimeType,
                  originalName: item.originalName,
                  storageKey: item.storageKey,
                  sizeBytes: item.sizeBytes,
                })),
              }
            : undefined,
        },
        include: {
          _count: { select: { reflections: true } },
          task: { select: { id: true, title: true, status: true } },
          attachments: attachmentList,
        },
      });
    } catch (error) {
      await this.media.removeMany(stored.map((item) => item.storageKey));
      throw error;
    }
  }

  async getAttachment(id: string, attachmentId: string, userId: string) {
    const attachment = await this.prisma.inspirationAttachment.findFirst({
      where: {
        id: attachmentId,
        inspirationId: id,
        inspiration: { userId },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    return attachment;
  }

  async transcribeAttachment(
    id: string,
    attachmentId: string,
    userId: string,
  ) {
    const attachment = await this.getAttachment(id, attachmentId, userId);
    if (attachment.kind !== 'audio') {
      throw new BadRequestException('当前只支持音频附件转写');
    }

    const buffer = await this.media.read(attachment.storageKey);
    const result = await this.voice.transcribeBuffer(buffer, attachment.mimeType);

    return this.prisma.inspirationAttachment.update({
      where: { id: attachment.id },
      data: {
        transcript: result.text,
        aiSummary: null,
      },
      select: attachmentList.select,
    });
  }

  async analyzeAttachment(
    id: string,
    attachmentId: string,
    userId: string,
  ) {
    const attachment = await this.prisma.inspirationAttachment.findFirst({
      where: {
        id: attachmentId,
        inspirationId: id,
        inspiration: { userId },
      },
      include: {
        inspiration: {
          select: {
            title: true,
            contentText: true,
          },
        },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!['image', 'video'].includes(attachment.kind)) {
      throw new BadRequestException('当前附件请使用音频转写/摘要功能');
    }

    const context = [
      attachment.inspiration.title,
      attachment.inspiration.contentText,
    ].filter(Boolean).join('\n').slice(0, 1000);
    const buffer = await this.media.read(attachment.storageKey);

    try {
      if (attachment.kind === 'image') {
        const result = await this.mediaAI.analyzeImage(
          buffer,
          attachment.mimeType,
          context,
        );
        return this.prisma.inspirationAttachment.update({
          where: { id: attachment.id },
          data: {
            aiSummary: result.summary,
          },
          select: attachmentList.select,
        });
      }

      const result = await this.mediaAI.analyzeVideo(
        buffer,
        attachment.mimeType,
        context,
      );
      return this.prisma.inspirationAttachment.update({
        where: { id: attachment.id },
        data: {
          transcript: result.transcript,
          aiSummary: result.summary,
        },
        select: attachmentList.select,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException
        || error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException('多模态 AI 暂时不可用，请稍后重试');
    }
  }

  async summarizeAttachment(
    id: string,
    attachmentId: string,
    userId: string,
  ) {
    const attachment = await this.prisma.inspirationAttachment.findFirst({
      where: {
        id: attachmentId,
        inspirationId: id,
        inspiration: { userId },
      },
      include: {
        inspiration: {
          select: {
            title: true,
            contentText: true,
          },
        },
      },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    if (!attachment.transcript?.trim()) {
      throw new BadRequestException('请先转写音频，再生成摘要');
    }

    let summary: string;
    try {
      summary = await this.ai.summarizeText({
        text: attachment.transcript,
        context: [
          attachment.inspiration.title,
          attachment.inspiration.contentText,
        ].filter(Boolean).join('\n').slice(0, 1000),
      });
    } catch {
      throw new ServiceUnavailableException('AI 摘要暂时不可用，请稍后重试');
    }

    return this.prisma.inspirationAttachment.update({
      where: { id: attachment.id },
      data: { aiSummary: summary },
      select: attachmentList.select,
    });
  }

  async update(id: string, userId: string, data: {
    title?: string | null;
    description?: string | null;
    contentText?: string | null;
    sourceUrl?: string | null;
    sourceType?: string;
    tags?: string[];
  }) {
    const existing = await this.prisma.inspiration.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Inspiration not found');

    return this.prisma.inspiration.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title?.trim() || null } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.contentText !== undefined ? { contentText: data.contentText?.trim() || null } : {}),
        ...(data.sourceUrl !== undefined ? { sourceUrl: data.sourceUrl?.trim() || null } : {}),
        ...(data.sourceType !== undefined ? { sourceType: data.sourceType || 'manual' } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
      },
      include: {
        _count: { select: { reflections: true } },
        task: { select: { id: true, title: true, status: true } },
        attachments: attachmentList,
      },
    });
  }

  updateStatus(id: string, userId: string, status: string) {
    return this.prisma.inspiration.update({
      where: { id, userId },
      data: { status },
    });
  }

  async remove(id: string, userId: string) {
    const existing = await this.prisma.inspiration.findFirst({
      where: { id, userId },
      select: {
        id: true,
        attachments: { select: { storageKey: true } },
      },
    });
    if (!existing) throw new NotFoundException('Inspiration not found');

    const deleted = await this.prisma.$transaction(async (tx) => {
      const affectedLinks = await tx.insightInspiration.findMany({
        where: { inspirationId: id },
        select: { insightId: true },
      });
      const deleted = await tx.inspiration.delete({ where: { id } });

      const unsupportedInsightIds: string[] = [];
      for (const { insightId } of affectedLinks) {
        const remainingSources = await tx.insightInspiration.count({ where: { insightId } });
        if (remainingSources < 2) unsupportedInsightIds.push(insightId);
      }
      if (unsupportedInsightIds.length > 0) {
        await tx.insight.deleteMany({
          where: { id: { in: unsupportedInsightIds }, userId },
        });
      }
      return deleted;
    });

    await this.media.removeMany(existing.attachments.map((item) => item.storageKey));
    return deleted;
  }

  async getReviewQueue(userId: string, requestedLimit?: number) {
    const limit = Math.min(Math.max(Number(requestedLimit) || 5, 1), 20);
    const now = new Date();
    const where = {
      userId,
      status: 'active',
      nextReviewAt: { lte: now },
    };

    const [total, items] = await this.prisma.$transaction([
      this.prisma.inspiration.count({ where }),
      this.prisma.inspiration.findMany({
        where,
        include: {
          reflections: { orderBy: { createdAt: 'desc' as const } },
          task: { select: { id: true, title: true, status: true } },
          attachments: attachmentList,
        },
        orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'asc' }],
        take: limit,
      }),
    ]);

    return { total, items };
  }

  async addReflection(id: string, userId: string, body: string) {
    const normalizedBody = body.trim();
    if (!normalizedBody) throw new BadRequestException('回顾内容不能为空');

    const inspiration = await this.prisma.inspiration.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!inspiration) throw new NotFoundException('Inspiration not found');

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.inspirationReflection.create({
        data: { userId, inspirationId: id, body: normalizedBody },
      }),
      this.prisma.inspiration.update({
        where: { id },
        data: {
          reviewState: 'pending',
          lastReviewedAt: now,
          nextReviewAt: addDays(now, 3),
          reviewCount: { increment: 1 },
        },
      }),
    ]);

    return this.findOne(id, userId);
  }

  async applyReviewAction(id: string, userId: string, action: 'later' | 'digested') {
    if (!['later', 'digested'].includes(action)) {
      throw new BadRequestException('Unsupported review action');
    }

    const inspiration = await this.prisma.inspiration.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!inspiration) throw new NotFoundException('Inspiration not found');

    const now = new Date();
    const nextReviewAt = addDays(now, action === 'later' ? 1 : 14);
    return this.prisma.inspiration.update({
      where: { id },
      data: {
        reviewState: action === 'digested' ? 'digested' : 'pending',
        lastReviewedAt: now,
        nextReviewAt,
        reviewCount: { increment: 1 },
      },
    });
  }

  async createTaskFromInspiration(id: string, userId: string, data: {
    title?: string;
    description?: string;
    estimatedMinutes?: number;
    dueDate?: string | null;
  } = {}) {
    const inspiration = await this.prisma.inspiration.findFirst({
      where: { id, userId },
      include: { task: true },
    });
    if (!inspiration) throw new NotFoundException('Inspiration not found');
    if (inspiration.task) return inspiration.task;

    const sourceText = inspiration.contentText || inspiration.description || inspiration.title || '';
    const title = data.title?.trim() || inspiration.title?.trim() || sourceText.trim().slice(0, 60) || '来自记录的待办';

    return this.prisma.task.create({
      data: {
        userId,
        inspirationId: inspiration.id,
        title,
        description: data.description?.trim() || sourceText || undefined,
        status: 'todo',
        priority: 'medium',
        section: 'personal',
        estimatedMinutes: data.estimatedMinutes,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        tags: inspiration.tags,
      },
    });
  }
}
