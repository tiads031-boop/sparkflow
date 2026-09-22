import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, SceneTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  entryMetadata,
  entryTags,
  templateData,
  type SceneField,
} from './scene-schema';

type EntryInput = {
  sourceType?: 'focus' | 'manual' | 'note' | 'task';
  occurredAt?: string;
  pomodoroSessionId?: string | null;
  taskId?: string | null;
  inspirationId?: string | null;
  metadata?: unknown;
  tags?: unknown;
  clientRequestId?: string;
};

function date(value: unknown, label: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value))
    throw new BadRequestException(`${label}必须是 ISO 时间`);
  const result = new Date(value);
  if (!Number.isFinite(result.getTime()))
    throw new BadRequestException(`${label}无效`);
  return result;
}

@Injectable()
export class ScenesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, status = 'active') {
    if (!['active', 'archived'].includes(status))
      throw new BadRequestException('状态无效');
    return this.prisma.sceneTemplate.findMany({
      where: { userId, status },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async get(userId: string, id: string): Promise<SceneTemplate> {
    const scene = await this.prisma.sceneTemplate.findFirst({
      where: { id, userId },
    });
    if (!scene) throw new NotFoundException('场景不存在');
    return scene;
  }

  create(userId: string, input: unknown) {
    const data = templateData(input);
    return this.prisma.sceneTemplate.create({
      data: { ...data, name: data.name as string, userId },
    });
  }

  async update(userId: string, id: string, input: unknown) {
    await this.get(userId, id);
    return this.prisma.sceneTemplate.update({
      where: { id, userId },
      data: templateData(input, true),
    });
  }

  async setStatus(userId: string, id: string, status: 'active' | 'archived') {
    await this.get(userId, id);
    return this.prisma.sceneTemplate.update({
      where: { id, userId },
      data: { status },
    });
  }

  async reorder(userId: string, ids: unknown) {
    if (
      !Array.isArray(ids) ||
      ids.length > 100 ||
      ids.some((id) => typeof id !== 'string') ||
      new Set(ids).size !== ids.length
    )
      throw new BadRequestException('排序列表无效');
    const existing = await this.prisma.sceneTemplate.findMany({
      where: { userId, status: 'active' },
      select: { id: true },
    });
    if (
      existing.length !== ids.length ||
      existing.some((scene) => !ids.includes(scene.id))
    )
      throw new BadRequestException('排序列表必须包含全部启用场景');
    const orderedIds = ids as string[];
    await this.prisma.$transaction(
      orderedIds.map((id, sortOrder) =>
        this.prisma.sceneTemplate.update({
          where: { id, userId },
          data: { sortOrder },
        }),
      ),
    );
    return this.list(userId);
  }

  private async assertSources(userId: string, input: EntryInput) {
    if (input.pomodoroSessionId) {
      const session = await this.prisma.pomodoroSession.findFirst({
        where: { id: input.pomodoroSessionId, userId },
      });
      if (
        !session ||
        !['completed', 'interrupted'].includes(session.status) ||
        !session.endedAt
      )
        throw new BadRequestException('时间记录不存在或尚未结束');
      if (input.sourceType === 'focus' && session.entrySource !== 'focus')
        throw new BadRequestException('来源类型与时间记录不符');
      if (input.sourceType === 'manual' && session.entrySource !== 'manual')
        throw new BadRequestException('来源类型与时间记录不符');
    }
    if (
      input.taskId &&
      !(await this.prisma.task.findFirst({
        where: { id: input.taskId, userId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('任务不存在');
    if (
      input.inspirationId &&
      !(await this.prisma.inspiration.findFirst({
        where: { id: input.inspirationId, userId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('记录不存在');
  }

  private validateSource(input: EntryInput) {
    if (!['focus', 'manual', 'note', 'task'].includes(input.sourceType || ''))
      throw new BadRequestException('记录来源无效');
    if (input.sourceType === 'focus' || input.sourceType === 'manual') {
      if (!input.pomodoroSessionId || input.inspirationId)
        throw new BadRequestException('时间场景须关联对应的时间记录');
    } else if (input.sourceType === 'note') {
      if (!input.inspirationId || input.pomodoroSessionId)
        throw new BadRequestException('图文场景须关联已有记录');
    } else if (!input.taskId || input.pomodoroSessionId || input.inspirationId)
      throw new BadRequestException('任务场景须关联已有任务');
  }

  private fields(scene: SceneTemplate): SceneField[] {
    return scene.fieldSchema as unknown as SceneField[];
  }

  async entries(
    userId: string,
    sceneId: string,
    query: { start?: string; end?: string; cursor?: string; limit?: string },
  ) {
    await this.get(userId, sceneId);
    const start = query.start ? date(query.start, '开始时间') : undefined;
    const end = query.end ? date(query.end, '结束时间') : undefined;
    if (start && end && start >= end)
      throw new BadRequestException('时间范围无效');
    const limit = query.limit === undefined ? 30 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new BadRequestException('分页大小无效');
    if (
      query.cursor &&
      !(await this.prisma.sceneEntry.findFirst({
        where: { id: query.cursor, userId, sceneId },
        select: { id: true },
      }))
    )
      throw new BadRequestException('分页游标无效');
    const rows = await this.prisma.sceneEntry.findMany({
      where: { userId, sceneId, occurredAt: { gte: start, lt: end } },
      include: {
        inspiration: { include: { attachments: true } },
        pomodoroSession: true,
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items, nextCursor: hasMore ? items.at(-1)?.id : null };
  }

  async createEntry(userId: string, sceneId: string, input: EntryInput) {
    const scene = await this.get(userId, sceneId);
    if (scene.status !== 'active') throw new BadRequestException('场景已归档');
    this.validateSource(input);
    const occurredAt = date(input.occurredAt, '发生时间');
    if (occurredAt.getTime() > Date.now() + 5 * 60_000)
      throw new BadRequestException('发生时间不能在未来');
    if (
      typeof input.clientRequestId !== 'string' ||
      !input.clientRequestId.trim() ||
      input.clientRequestId.length > 100
    )
      throw new BadRequestException('clientRequestId 无效');
    const existing = await this.prisma.sceneEntry.findFirst({
      where: { userId, clientRequestId: input.clientRequestId },
    });
    if (existing) {
      if (existing.sceneId !== sceneId)
        throw new ConflictException('请求 ID 已用于其他场景');
      return existing;
    }
    await this.assertSources(userId, input);
    const metadata = entryMetadata(input.metadata, this.fields(scene));
    const tags = entryTags(input.tags ?? []);
    try {
      return await this.prisma.sceneEntry.create({
        data: {
          userId,
          sceneId,
          sourceType: input.sourceType!,
          occurredAt,
          metadata,
          tags,
          clientRequestId: input.clientRequestId,
          pomodoroSessionId: input.pomodoroSessionId || null,
          taskId: input.taskId || null,
          inspirationId: input.inspirationId || null,
        },
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'P2002') {
        const repeated = await this.prisma.sceneEntry.findFirst({
          where: { userId, clientRequestId: input.clientRequestId },
        });
        if (repeated && repeated.sceneId === sceneId) return repeated;
        throw new ConflictException('记录已经关联其他场景或请求 ID 已使用');
      }
      throw error;
    }
  }

  async updateEntry(
    userId: string,
    sceneId: string,
    entryId: string,
    input: Record<string, unknown>,
  ) {
    const scene = await this.get(userId, sceneId);
    const existing = await this.prisma.sceneEntry.findFirst({
      where: { id: entryId, sceneId, userId },
    });
    if (!existing) throw new NotFoundException('场景记录不存在');
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).some(
        (key) => !['occurredAt', 'metadata', 'tags'].includes(key),
      )
    )
      throw new BadRequestException('只能修改发生时间、字段和标签');
    const data: Prisma.SceneEntryUpdateInput = {};
    if (input.occurredAt !== undefined) {
      data.occurredAt = date(input.occurredAt, '发生时间');
      if (data.occurredAt.getTime() > Date.now() + 5 * 60_000)
        throw new BadRequestException('发生时间不能在未来');
    }
    if (input.metadata !== undefined)
      data.metadata = entryMetadata(input.metadata, this.fields(scene));
    if (input.tags !== undefined) data.tags = entryTags(input.tags);
    return this.prisma.sceneEntry.update({
      where: { id: entryId, userId, sceneId },
      data,
    });
  }

  async deleteEntry(userId: string, sceneId: string, entryId: string) {
    const result = await this.prisma.sceneEntry.deleteMany({
      where: { id: entryId, userId, sceneId },
    });
    if (!result.count) throw new NotFoundException('场景记录不存在');
    return { deleted: true };
  }
}
