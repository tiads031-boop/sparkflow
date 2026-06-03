import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ImportLocalCalendarEventDto {
  externalEventId: string;
  title: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  eventType?: string;
  sourceCalendarTitle?: string;
  location?: string;
  description?: string;
  color?: string;
}

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, start: string, end: string, semesterId?: string) {
    const where: any = {
      userId,
      startTime: { lt: new Date(end) },
      endTime: { gt: new Date(start) },
    };

    if (semesterId) {
      where.OR = [
        { courseId: null },
        { course: { semesterId } },
      ];
    }

    return this.prisma.calendarEvent.findMany({
      where,
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
    location?: string;
    externalSource?: string;
    externalEventId?: string;
    sourceCalendarTitle?: string;
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

  async importLocal(data: {
    userId: string;
    platform?: string;
    source?: string;
    events: ImportLocalCalendarEventDto[];
  }) {
    const externalSource = data.source ?? data.platform ?? 'android-local';
    const imported = [];

    for (const event of data.events) {
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      const saved = await this.prisma.calendarEvent.upsert({
        where: {
          userId_externalSource_externalEventId: {
            userId: data.userId,
            externalSource,
            externalEventId: event.externalEventId,
          },
        },
        update: {
          title: event.title,
          startTime,
          endTime,
          isAllDay: event.isAllDay ?? false,
          eventType: event.eventType ?? 'local',
          sourceCalendarTitle: event.sourceCalendarTitle,
          location: event.location,
          color: event.color ?? '#185FA5',
          syncStatus: 'skipped',
        },
        create: {
          userId: data.userId,
          title: event.title,
          startTime,
          endTime,
          isAllDay: event.isAllDay ?? false,
          eventType: event.eventType ?? 'local',
          sourceCalendarTitle: event.sourceCalendarTitle,
          location: event.location,
          color: event.color ?? '#185FA5',
          externalSource,
          externalEventId: event.externalEventId,
          syncStatus: 'skipped',
        },
      });

      const task = saved.taskId
        ? await this.prisma.task.update({
            where: { id: saved.taskId },
            data: {
              title: event.title,
              description: event.description,
              dueDate: startTime,
              scheduledStart: event.isAllDay ? null : startTime,
              scheduledEnd: event.isAllDay ? null : endTime,
              estimatedMinutes: event.isAllDay
                ? null
                : Math.max(15, Math.round((endTime.getTime() - startTime.getTime()) / 60000)),
            },
          })
        : await this.prisma.task.create({
            data: {
              userId: data.userId,
              title: event.title,
              description: event.description,
              status: 'todo',
              priority: 'medium',
              section: 'calendar',
              dueDate: startTime,
              scheduledStart: event.isAllDay ? null : startTime,
              scheduledEnd: event.isAllDay ? null : endTime,
              estimatedMinutes: event.isAllDay
                ? null
                : Math.max(15, Math.round((endTime.getTime() - startTime.getTime()) / 60000)),
            },
          });

      const linked = saved.taskId
        ? saved
        : await this.prisma.calendarEvent.update({
            where: { id: saved.id },
            data: { taskId: task.id },
          });

      imported.push(linked);
    }

    return { importedCount: imported.length, eventCount: imported.length, events: imported };
  }
}
