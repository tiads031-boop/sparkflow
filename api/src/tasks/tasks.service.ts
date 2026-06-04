import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

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
    priority?: string;
    dueDate?: string;
    estimatedMinutes?: number;
    tags?: string[];
    inspirationId?: string;
  }) {
    const { dueDate, ...rest } = data;
    return this.prisma.task.create({
      data: {
        ...rest,
        ...(dueDate && { dueDate: new Date(dueDate) }),
      },
    });
  }

  update(id: string, data: Record<string, any>) {
    return this.prisma.task.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.task.delete({ where: { id } });
  }
}
