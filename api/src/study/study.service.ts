import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { StudyFolderInput } from './study.controller';

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
    const threadByGoalId = new Map<string, typeof threads[number]>();
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
        courses: { create: courseIds.map((courseId) => ({ courseId })) },
        tasks: { create: taskIds.map((taskId) => ({ taskId })) },
      },
      include: folderInclude,
    });
    return this.present(folder);
  }

  async update(id: string, userId: string, input: StudyFolderInput) {
    await this.findOne(id, userId);
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
}
