import { Injectable } from '@nestjs/common';
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

  findOne(id: string) {
    return this.prisma.task.findUnique({
      where: { id },
      include: { pomodoroSessions: true, inspiration: true },
    });
  }

  create(data: {
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
    return this.prisma.task.create({
      data: this.normalizeTaskDates(data),
    });
  }

  update(id: string, data: Record<string, any>) {
    return this.prisma.task.update({
      where: { id },
      data: this.normalizeTaskDates(data),
    });
  }

  remove(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}
