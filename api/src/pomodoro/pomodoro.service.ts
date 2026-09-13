import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';

@Injectable()
export class PomodoroService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, date?: string) {
    const where: Prisma.PomodoroSessionWhereInput = { userId };
    if (date) {
      const d = new Date(date);
      where.startedAt = {
        gte: d,
        lt: new Date(d.getTime() + 86400000),
      };
    }
    return this.prisma.pomodoroSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      include: { task: true },
    });
  }

  async getStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCount, weekCount, totalMinutes] = await Promise.all([
      this.prisma.pomodoroSession.count({
        where: { userId, status: 'completed', startedAt: { gte: today } },
      }),
      this.prisma.pomodoroSession.count({
        where: {
          userId,
          status: 'completed',
          startedAt: {
            gte: new Date(today.getTime() - 7 * 86400000),
          },
        },
      }),
      this.prisma.pomodoroSession.aggregate({
        where: { userId, status: 'completed' },
        _sum: { duration: true },
      }),
    ]);

    return {
      todayCount,
      weekCount,
      totalMinutes: totalMinutes._sum.duration ?? 0,
    };
  }

  async create(data: {
    userId: string;
    taskId?: string;
    duration?: number;
    notes?: string;
  }) {
    if (data.taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: data.taskId, userId: data.userId },
        select: { id: true },
      });
      if (!task) throw new NotFoundException('Task not found');
    }
    return this.prisma.pomodoroSession.create({
      data: { ...data, status: 'active' },
    });
  }

  async complete(id: string, userId: string) {
    const session = await this.prisma.pomodoroSession.findFirst({
      where: { id, userId },
    });
    if (!session) throw new NotFoundException('Pomodoro session not found');
    const elapsedMinutes = Math.max(
      1,
      Math.min(
        session.duration,
        Math.ceil((Date.now() - session.startedAt.getTime()) / 60000),
      ),
    );
    return this.prisma.pomodoroSession.update({
      where: { id, userId },
      data: {
        endedAt: new Date(),
        duration: elapsedMinutes,
        status: 'completed',
      },
    });
  }

  interrupt(id: string, userId: string) {
    return this.prisma.pomodoroSession.update({
      where: { id, userId },
      data: { endedAt: new Date(), status: 'interrupted' },
    });
  }
}
