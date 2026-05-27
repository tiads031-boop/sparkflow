import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PomodoroService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, date?: string) {
    const where: any = { userId };
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
        where: { userId, startedAt: { gte: today } },
      }),
      this.prisma.pomodoroSession.count({
        where: {
          userId,
          startedAt: {
            gte: new Date(today.getTime() - 7 * 86400000),
          },
        },
      }),
      this.prisma.pomodoroSession.aggregate({
        where: { userId },
        _sum: { duration: true },
      }),
    ]);

    return {
      todayCount,
      weekCount,
      totalMinutes: totalMinutes._sum.duration ?? 0,
    };
  }

  create(data: {
    userId: string;
    taskId?: string;
    duration?: number;
    notes?: string;
  }) {
    return this.prisma.pomodoroSession.create({ data });
  }

  complete(id: string) {
    return this.prisma.pomodoroSession.update({
      where: { id },
      data: { endedAt: new Date(), status: 'completed' },
    });
  }
}
