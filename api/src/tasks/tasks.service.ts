import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private toNullableDate(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (value instanceof Date) return value;
    return new Date(String(value));
  }

  private normalizeTaskDates<T extends Record<string, any>>(data: T): T {
    const normalized: Record<string, any> = { ...data };
    const dateFields = [
      'dueDate',
      'scheduledStart',
      'scheduledEnd',
      'completedAt',
      'reminderAt',
      'repeatStartDate',
      'repeatEndDate',
    ];

    for (const field of dateFields) {
      if (field in normalized) {
        const value = this.toNullableDate(normalized[field]);
        if (value === undefined) delete normalized[field];
        else normalized[field] = value;
      }
    }

    return normalized as T;
  }

  findAll(userId: string, status?: string, date?: string) {
    const where: any = {
      userId,
      OR: [
        { section: null },
        { section: { not: 'calendar' } },
      ],
    };
    if (status) where.status = status;
    if (date) {
      const d = new Date(date);
      where.dueDate = {
        gte: d,
        lt: new Date(d.getTime() + 86400000),
      };
    }
    return this.prisma.task.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  findOne(id: string, userId: string) {
    return this.prisma.task.findFirst({
      where: { id, userId },
      include: { pomodoroSessions: true, inspiration: true },
    });
  }

  async create(data: {
    userId: string;
    title: string;
    description?: string;
    status?: string;
    priority?: string;
    section?: string | null;
    project?: string | null;
    notes?: any;
    dueDate?: string;
    reminderAt?: string | null;
    repeatRule?: string | null;
    repeatStartDate?: string | null;
    repeatEndDate?: string | null;
    estimatedMinutes?: number;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    tags?: string[];
    inspirationId?: string;
    courseId?: string | null;
  }) {
    if (data.courseId) {
      const course = await this.prisma.course.findFirst({ where: { id: data.courseId, userId: data.userId }, select: { id: true } });
      if (!course) throw new NotFoundException('Course not found');
    }
    if (data.inspirationId) {
      const inspiration = await this.prisma.inspiration.findFirst({ where: { id: data.inspirationId, userId: data.userId }, select: { id: true } });
      if (!inspiration) throw new NotFoundException('Inspiration not found');
    }
    return this.prisma.task.create({
      data: this.normalizeTaskDates(data),
    });
  }

  update(id: string, userId: string, data: Record<string, any>) {
    const { userId: _ignoredUserId, ...safeData } = data;
    return this.prisma.task.update({
      where: { id, userId },
      data: this.normalizeTaskDates(safeData),
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.task.delete({ where: { id, userId } });
  }
}
