import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TagInput {
  name: string;
  color?: string;
  parentId?: string | null;
  sortOrder?: number;
  archived?: boolean;
}

const COLOR_RE = /^#[0-9a-f]{6}$/i;

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, includeArchived = false) {
    return this.prisma.tag.findMany({
      where: { userId, ...(includeArchived ? {} : { archived: false }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private normalized(input: Partial<TagInput>, requireName = false) {
    const data: Partial<TagInput> = {};
    if (input.name !== undefined || requireName) {
      const name = String(input.name || '').trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (!name) throw new BadRequestException('标签名称不能为空');
      data.name = name;
    }
    if (input.color !== undefined) {
      if (!COLOR_RE.test(input.color)) throw new BadRequestException('标签颜色必须是 6 位十六进制颜色');
      data.color = input.color.toLowerCase();
    }
    if (input.parentId !== undefined) data.parentId = input.parentId || null;
    if (input.sortOrder !== undefined) {
      if (!Number.isInteger(input.sortOrder)) throw new BadRequestException('标签排序必须是整数');
      data.sortOrder = Math.max(0, Math.min(10_000, input.sortOrder));
    }
    if (input.archived !== undefined) data.archived = Boolean(input.archived);
    return data;
  }

  private async assertParent(userId: string, parentId?: string | null, currentId?: string) {
    if (!parentId) return;
    if (parentId === currentId) throw new BadRequestException('标签不能以自己为父级');
    const parent = await this.prisma.tag.findFirst({ where: { id: parentId, userId, archived: false } });
    if (!parent) throw new BadRequestException('父级标签不存在或已归档');
    if (parent.parentId) throw new BadRequestException('第一版仅支持两级标签');
  }

  async create(userId: string, input: TagInput) {
    const data = this.normalized(input, true);
    await this.assertParent(userId, data.parentId);
    try {
      return await this.prisma.tag.create({ data: { ...data, name: data.name!, userId } });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('同名标签已存在');
      throw error;
    }
  }

  async update(userId: string, id: string, input: Partial<TagInput>) {
    const existing = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('标签不存在');
    const data = this.normalized(input);
    await this.assertParent(userId, data.parentId, id);
    if (data.parentId) {
      const hasChildren = await this.prisma.tag.count({ where: { parentId: id, userId, archived: false } });
      if (hasChildren) throw new BadRequestException('含子标签的标签不能再设为二级标签');
    }

    const oldName = existing.name;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.tag.update({ where: { id, userId }, data });
        if (data.name && data.name !== oldName) {
          await tx.$executeRaw`
            UPDATE "tasks" SET "tags" = array_replace("tags", ${oldName}, ${data.name})
            WHERE "userId" = ${userId} AND ${oldName} = ANY("tags")
          `;
          await tx.$executeRaw`
            UPDATE "inspirations" SET "tags" = array_replace("tags", ${oldName}, ${data.name})
            WHERE "userId" = ${userId} AND ${oldName} = ANY("tags")
          `;
        }
        return updated;
      });
    } catch (error: any) {
      if (error?.code === 'P2002') throw new ConflictException('同名标签已存在');
      throw error;
    }
  }

  async archive(userId: string, id: string) {
    const existing = await this.prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('标签不存在');
    await this.prisma.tag.updateMany({ where: { parentId: id, userId }, data: { parentId: null } });
    return this.prisma.tag.update({ where: { id, userId }, data: { archived: true, parentId: null } });
  }
}
