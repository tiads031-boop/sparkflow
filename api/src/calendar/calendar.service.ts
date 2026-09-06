import { Injectable, NotFoundException } from '@nestjs/common';
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

  private getEstimatedMinutes(startTime: Date, endTime: Date, isAllDay?: boolean) {
    if (isAllDay) return null;
    return Math.max(15, Math.round((endTime.getTime() - startTime.getTime()) / 60000));
  }

  private taskDataFromLocalEvent(
    userId: string,
    event: ImportLocalCalendarEventDto,
    startTime: Date,
    endTime: Date,
    includeDefaults = false,
  ) {
    const isAllDay = event.isAllDay ?? false;
    const taskData: Record<string, any> = {
      title: event.title,
      dueDate: startTime,
      scheduledStart: isAllDay ? null : startTime,
      scheduledEnd: isAllDay ? null : endTime,
      estimatedMinutes: this.getEstimatedMinutes(startTime, endTime, isAllDay),
    };

    if (includeDefaults) {
      taskData.userId = userId;
      taskData.section = 'personal';
      taskData.status = 'todo';
      taskData.priority = 'medium';
    }
    if (event.description !== undefined) taskData.description = event.description;
    return taskData;
  }

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

  async create(data: {
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
    if (data.taskId) {
      const task = await this.prisma.task.findFirst({ where: { id: data.taskId, userId: data.userId }, select: { id: true } });
      if (!task) throw new NotFoundException('Task not found');
    }
    return this.prisma.calendarEvent.create({
      data: {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
      },
    });
  }

  update(id: string, userId: string, data: Record<string, any>) {
    const { userId: _ignoredUserId, ...updateData } = data;
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);
    return this.prisma.calendarEvent.update({
      where: { id, userId },
      data: updateData,
    });
  }

  remove(id: string, userId: string) {
    return this.prisma.calendarEvent.delete({ where: { id, userId } });
  }

  async importLocal(data: {
    userId: string;
    platform?: string;
    source?: string;
    events: ImportLocalCalendarEventDto[];
  }) {
    const externalSource = data.source ?? data.platform ?? 'android-local';
    const imported = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const event of data.events) {
      if (!event.externalEventId || !event.title || !event.startTime || !event.endTime) {
        skipped += 1;
        continue;
      }

      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
        skipped += 1;
        continue;
      }

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

      let linkedEvent = saved;
      const taskData = this.taskDataFromLocalEvent(data.userId, event, startTime, endTime);
      if (saved.taskId) {
        await this.prisma.task.update({
          where: { id: saved.taskId },
          data: taskData,
        });
        updated += 1;
      } else {
        const task = await this.prisma.task.create({
          data: this.taskDataFromLocalEvent(data.userId, event, startTime, endTime, true) as any,
        });
        linkedEvent = await this.prisma.calendarEvent.update({
          where: { id: saved.id },
          data: { taskId: task.id },
        });
        created += 1;
      }

      imported.push(linkedEvent);
    }

    return {
      importedCount: imported.length,
      eventCount: imported.length,
      events: imported,
      created,
      updated,
      skipped,
    };
  }
}
