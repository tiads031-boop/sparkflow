import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, start: string, end: string) {
    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        startTime: { gte: new Date(start) },
        endTime: { lte: new Date(end) },
      },
      orderBy: { startTime: 'asc' },
      include: { task: true },
    });
  }

  create(data: {
    userId: string;
    title: string;
    startTime: string;
    endTime: string;
    eventType?: string;
    taskId?: string;
    isAllDay?: boolean;
    color?: string;
  }) {
    return this.prisma.calendarEvent.create({
      data: {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
    });
  }

  update(id: string, data: Record<string, any>) {
    const updateData = { ...data };
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    return this.prisma.calendarEvent.update({
      where: { id },
      data: updateData,
    });
  }

  remove(id: string) {
    return this.prisma.calendarEvent.delete({ where: { id } });
  }
}
