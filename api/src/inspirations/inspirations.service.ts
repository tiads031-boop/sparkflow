import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

@Injectable()
export class InspirationsService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, status?: string) {
    return this.prisma.inspiration.findMany({
      where: { userId, ...(status && { status }) },
      include: {
        _count: { select: { reflections: true } },
        task: { select: { id: true, title: true, status: true } },
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
      },
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
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Inspiration not found');
    return this.prisma.inspiration.delete({ where: { id } });
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
