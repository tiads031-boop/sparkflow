import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as ical from 'node-ical';
import { parseCourseBackup } from './course-backup';
import { parseCourseImport, previewCourseImport, type ParsedCourseImport } from './course-import';
import { randomUUID } from 'crypto';

interface CourseCreateData {
  userId: string;
  name: string;
  teacher?: string;
  room?: string;
  color?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  weeks?: number[];
  location?: string;
  icsUid?: string;
  semesterId?: string;
}

interface CourseUpdateData {
  name?: string;
  teacher?: string;
  room?: string;
  color?: string;
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  weeks?: number[];
  location?: string;
  semesterId?: string;
  regenerate?: boolean; // 是否触发换课：重新生成 CalendarEvent
}

interface NoteData {
  userId: string;
  courseId: string;
  body: string;
  pinned?: boolean;
}

const courseNoteImages = {
  orderBy: { createdAt: 'asc' as const },
  select: { id: true, noteId: true, mimeType: true, originalName: true, sizeBytes: true, createdAt: true },
};

type CourseChangeRequest =
  | {
      type: 'reschedule';
      eventId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
    }
  | {
      type: 'cancel';
      eventId: string;
    }
  | {
      type: 'extra';
      courseId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
      title?: string;
    }
  | {
      type: 'swap';
      eventId: string;
      otherEventId: string;
    };

type CourseChangePoint = {
  startTime: string;
  endTime: string;
  location: string | null;
};

type CourseChangePreviewItem = {
  action: 'update' | 'cancel' | 'create';
  eventId: string | null;
  courseId: string;
  courseName: string;
  title: string;
  from: CourseChangePoint | null;
  to: CourseChangePoint | null;
};

type CourseChangeConflict = {
  changeIndex: number;
  sourceType: 'calendar' | 'task';
  id: string;
  title: string;
  startTime: string;
  endTime: string;
};

type CourseEventState = {
  eventId: string;
  existed: boolean;
  courseId: string | null;
  title: string;
  eventType: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  isOverride: boolean;
  color: string;
  location: string | null;
  scheduleLocked: boolean;
  overrideType: string | null;
  overrideOriginalStart: string | null;
  overrideGroupId: string | null;
};

function courseEventState(event: any, existed = true): CourseEventState {
  return {
    eventId: event.id,
    existed,
    courseId: event.courseId || null,
    title: event.title,
    eventType: event.eventType,
    startTime: event.startTime instanceof Date ? event.startTime.toISOString() : String(event.startTime),
    endTime: event.endTime instanceof Date ? event.endTime.toISOString() : String(event.endTime),
    isAllDay: Boolean(event.isAllDay),
    recurrenceRule: event.recurrenceRule || null,
    isOverride: Boolean(event.isOverride),
    color: event.color,
    location: event.location || null,
    scheduleLocked: Boolean(event.scheduleLocked),
    overrideType: event.overrideType || null,
    overrideOriginalStart: event.overrideOriginalStart
      ? (event.overrideOriginalStart instanceof Date
          ? event.overrideOriginalStart.toISOString()
          : String(event.overrideOriginalStart))
      : null,
    overrideGroupId: event.overrideGroupId || null,
  };
}

function readCourseEventStates(value: unknown): CourseEventState[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.eventId !== 'string' ||
      typeof candidate.existed !== 'boolean' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.eventType !== 'string' ||
      typeof candidate.startTime !== 'string' ||
      typeof candidate.endTime !== 'string' ||
      typeof candidate.isAllDay !== 'boolean' ||
      typeof candidate.isOverride !== 'boolean' ||
      typeof candidate.color !== 'string' ||
      typeof candidate.scheduleLocked !== 'boolean'
    ) return [];
    return [candidate as unknown as CourseEventState];
  });
}

function sameCourseEventState(event: any, expected: CourseEventState) {
  return JSON.stringify(courseEventState(event, true)) === JSON.stringify({
    ...expected,
    existed: true,
  });
}


type CourseTemplateChanges = {
  dayOfWeek?: number;
  startTime?: string;
  endTime?: string;
  room?: string | null;
  location?: string | null;
};

type CourseTemplateChangeRequest = {
  courseId: string;
  effectiveFrom: string;
  changes: CourseTemplateChanges;
};

type CourseTemplateState = {
  courseId: string;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
  location: string | null;
};

type CourseTemplateEventState = {
  eventId: string;
  taskId: string | null;
  courseId: string | null;
  title: string;
  eventType: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  isOverride: boolean;
  overrideType: string | null;
  overrideOriginalStart: string | null;
  overrideGroupId: string | null;
  color: string;
  location: string | null;
  externalSource: string | null;
  externalEventId: string | null;
  sourceCalendarTitle: string | null;
  googleEventId: string | null;
  googleSyncedAt: string | null;
  syncStatus: string;
  scheduleLocked: boolean;
};

type CourseTemplatePlanState = {
  effectiveFrom: string;
  course: CourseTemplateState;
  events: CourseTemplateEventState[];
};

type CourseTemplateConflict = {
  occurrenceIndex: number;
  sourceType: 'calendar' | 'task';
  id: string;
  title: string;
  startTime: string;
  endTime: string;
};

function courseTemplateState(course: any): CourseTemplateState {
  return {
    courseId: course.id,
    dayOfWeek: typeof course.dayOfWeek === 'number' ? course.dayOfWeek : null,
    startTime: course.startTime || null,
    endTime: course.endTime || null,
    room: course.room || null,
    location: course.location || null,
  };
}

function courseTemplateEventState(event: any): CourseTemplateEventState {
  return {
    eventId: event.id,
    taskId: event.taskId || null,
    courseId: event.courseId || null,
    title: event.title,
    eventType: event.eventType,
    startTime: event.startTime instanceof Date ? event.startTime.toISOString() : String(event.startTime),
    endTime: event.endTime instanceof Date ? event.endTime.toISOString() : String(event.endTime),
    isAllDay: Boolean(event.isAllDay),
    recurrenceRule: event.recurrenceRule || null,
    isOverride: Boolean(event.isOverride),
    overrideType: event.overrideType || null,
    overrideOriginalStart: event.overrideOriginalStart
      ? (event.overrideOriginalStart instanceof Date
          ? event.overrideOriginalStart.toISOString()
          : String(event.overrideOriginalStart))
      : null,
    overrideGroupId: event.overrideGroupId || null,
    color: event.color,
    location: event.location || null,
    externalSource: event.externalSource || null,
    externalEventId: event.externalEventId || null,
    sourceCalendarTitle: event.sourceCalendarTitle || null,
    googleEventId: event.googleEventId || null,
    googleSyncedAt: event.googleSyncedAt
      ? (event.googleSyncedAt instanceof Date
          ? event.googleSyncedAt.toISOString()
          : String(event.googleSyncedAt))
      : null,
    syncStatus: event.syncStatus || 'pending',
    scheduleLocked: Boolean(event.scheduleLocked),
  };
}

function readCourseTemplatePlanState(value: unknown): CourseTemplatePlanState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.effectiveFrom !== 'string' ||
    !candidate.course ||
    typeof candidate.course !== 'object' ||
    !Array.isArray(candidate.events)
  ) return null;
  const course = candidate.course as Record<string, unknown>;
  if (typeof course.courseId !== 'string') return null;

  const events = candidate.events.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const event = item as Record<string, unknown>;
    if (
      typeof event.eventId !== 'string' ||
      typeof event.title !== 'string' ||
      typeof event.eventType !== 'string' ||
      typeof event.startTime !== 'string' ||
      typeof event.endTime !== 'string' ||
      typeof event.isAllDay !== 'boolean' ||
      typeof event.isOverride !== 'boolean' ||
      typeof event.color !== 'string' ||
      typeof event.syncStatus !== 'string' ||
      typeof event.scheduleLocked !== 'boolean'
    ) return [];
    return [event as unknown as CourseTemplateEventState];
  });

  if (events.length !== candidate.events.length) return null;
  return {
    effectiveFrom: candidate.effectiveFrom,
    course: course as unknown as CourseTemplateState,
    events,
  };
}

function sameCourseTemplateState(course: any, expected: CourseTemplateState) {
  return JSON.stringify(courseTemplateState(course)) === JSON.stringify(expected);
}

function sameCourseTemplateEventState(event: any, expected: CourseTemplateEventState) {
  return JSON.stringify(courseTemplateEventState(event)) === JSON.stringify(expected);
}

@Injectable()
export class CourseService {
  constructor(private prisma: PrismaService) {}

  async exportSchedule(userId: string, semesterId?: string) {
    const courses = await this.prisma.course.findMany({
      where: { userId, ...(semesterId ? { semesterId } : {}) },
      include: { events: { orderBy: { startTime: 'asc' } } },
    });
    const semesters = await this.prisma.semester.findMany({ where: { userId, ...(semesterId ? { id: semesterId } : {}) } });
    return { format: 'sparkflow-courses', version: 1, exportedAt: new Date().toISOString(), semesters, courses };
  }

  async previewScheduleImport(userId: string, value: unknown) {
    const request = parseCourseImport(value);
    const targetSemester = request.targetSemesterId
      ? await this.prisma.semester.findFirst({ where: { id: request.targetSemesterId, userId } })
      : null;
    if (request.targetSemesterId && !targetSemester) throw new NotFoundException('Semester not found');
    const existing = targetSemester
      ? await this.prisma.course.findMany({
          where: { userId, semesterId: targetSemester.id },
          select: this.importCourseSelect(),
        })
      : [];
    return {
      requestId: request.requestId,
      payloadHash: request.payloadHash,
      targetSemester: targetSemester
        ? { id: targetSemester.id, name: targetSemester.name, startDate: targetSemester.startDate, endDate: targetSemester.endDate }
        : null,
      duplicatePolicy: request.duplicatePolicy,
      ...previewCourseImport(request.backup.courses, existing, request.source),
    };
  }

  async getScheduleImport(userId: string, requestId: string) {
    const batch = await this.prisma.courseImportBatch.findUnique({ where: { userId_requestId: { userId, requestId } } });
    if (!batch) throw new NotFoundException('Course import not found');
    return {
      requestId: batch.requestId,
      status: batch.status,
      payloadHash: batch.payloadHash,
      targetSemesterId: batch.targetSemesterId,
      result: batch.result,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };
  }

  async importSchedule(userId: string, value: unknown) {
    const request = parseCourseImport(value);
    if (request.legacy) return this.importLegacySchedule(userId, request.backup);

    const previous = await this.prisma.courseImportBatch.findUnique({
      where: { userId_requestId: { userId, requestId: request.requestId! } },
    });
    if (previous) return this.replayImport(previous, request.payloadHash);

    try {
      return await this.importVersion2(userId, request);
    } catch (error) {
      const raced = await this.prisma.courseImportBatch.findUnique({
        where: { userId_requestId: { userId, requestId: request.requestId! } },
      });
      if (raced) return this.replayImport(raced, request.payloadHash);
      throw error;
    }
  }

  private async importLegacySchedule(userId: string, backup: ReturnType<typeof parseCourseBackup>) {
    return this.prisma.$transaction(async tx => {
      const ids = new Map<string, string>();
      for (const s of backup.semesters) {
        const created = await tx.semester.create({ data: { userId, name: s.name, startDate: new Date(s.startDate), endDate: new Date(s.endDate), isActive: false } });
        ids.set(s.id, created.id);
      }
      let eventCount = 0;
      for (const c of backup.courses) {
        const { events, semesterId, ...data } = c;
        const course = await tx.course.create({ data: { ...data, userId, semesterId: semesterId ? ids.get(semesterId) : null } });
        if (events.length) await tx.calendarEvent.createMany({ data: events.map(e => ({ ...e, userId, courseId: course.id, eventType: 'course', color: course.color, startTime: new Date(e.startTime), endTime: new Date(e.endTime) })) });
        eventCount += events.length;
      }
      return { courseCount: backup.courses.length, eventCount };
    }, { timeout: 30000 });
  }

  private async importVersion2(userId: string, request: ParsedCourseImport) {
    return this.prisma.$transaction(async tx => {
      const batch = await tx.courseImportBatch.create({
        data: {
          userId,
          requestId: request.requestId!,
          payloadHash: request.payloadHash,
          targetSemesterId: request.targetSemesterId,
          duplicatePolicy: request.duplicatePolicy,
          source: request.source ? JSON.parse(JSON.stringify(request.source)) : undefined,
        },
      });

      let targetSemesterId = request.targetSemesterId;
      if (targetSemesterId) {
        const owned = await tx.semester.findFirst({ where: { id: targetSemesterId, userId }, select: { id: true } });
        if (!owned) throw new NotFoundException('Semester not found');
      } else {
        const semester = request.backup.semesters[0];
        const created = await tx.semester.create({
          data: {
            userId,
            name: semester.name,
            startDate: new Date(semester.startDate),
            endDate: new Date(semester.endDate),
            isActive: false,
          },
        });
        targetSemesterId = created.id;
      }

      const existing = await tx.course.findMany({
        where: { userId, semesterId: targetSemesterId },
        select: this.importCourseSelect(),
      });
      const preview = previewCourseImport(request.backup.courses, existing, request.source);
      let courseCount = 0;
      let eventCount = 0;
      let skippedCount = 0;

      for (const item of preview.items) {
        if (item.duplicate && request.duplicatePolicy === 'skip') {
          skippedCount += 1;
          continue;
        }
        const input = request.backup.courses[item.index];
        const { events, semesterId: _semesterId, sourceFingerprint: _sourceFingerprint, ...data } = input;
        const course = await tx.course.create({
          data: {
            ...data,
            userId,
            semesterId: targetSemesterId,
            sourceType: request.source?.system,
            sourceSchoolId: request.source?.schoolId,
            sourceTermId: request.source?.termId,
            sourceFingerprint: item.fingerprint,
            importBatchId: batch.id,
          },
        });
        if (events.length) await tx.calendarEvent.createMany({
          data: events.map(event => ({
            ...event,
            userId,
            courseId: course.id,
            eventType: 'course',
            color: course.color,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
          })),
        });
        courseCount += 1;
        eventCount += events.length;
      }

      const result = {
        requestId: request.requestId!,
        replayed: false,
        targetSemesterId,
        scheduleEntryCount: request.backup.courses.length,
        courseCount,
        eventCount,
        skippedCount,
        conflictCount: preview.summary.conflictCount,
      };
      await tx.courseImportBatch.update({
        where: { id: batch.id },
        data: { status: 'applied', targetSemesterId, result },
      });
      return result;
    }, { timeout: 30000, isolationLevel: 'Serializable' });
  }

  private replayImport(batch: { status: string; payloadHash: string; result: unknown }, payloadHash: string) {
    if (batch.payloadHash !== payloadHash) throw new ConflictException('同一导入请求标识不能用于不同课表');
    if (batch.status !== 'applied' || !batch.result || typeof batch.result !== 'object' || Array.isArray(batch.result)) {
      throw new ConflictException('导入仍在处理中，请先查询导入结果');
    }
    return { ...(batch.result as Record<string, unknown>), replayed: true };
  }

  private importCourseSelect() {
    return {
      id: true,
      name: true,
      teacher: true,
      room: true,
      location: true,
      dayOfWeek: true,
      startTime: true,
      endTime: true,
      weeks: true,
      sourceEntryId: true,
      sourceFingerprint: true,
    } as const;
  }

  // ==================== Course CRUD ====================

  async findAll(userId: string, semesterId?: string) {
    const where: any = { userId };
    if (semesterId) {
      where.semesterId = semesterId;
    }
    return this.prisma.course.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { events: true, tasks: true, notes: true } } },
    });
  }

  async findOne(id: string, userId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, userId },
      include: {
        events: { orderBy: { startTime: 'asc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }], include: { images: courseNoteImages } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async create(data: CourseCreateData) {
    await this.assertOwnedSemester(data.semesterId, data.userId);
    const course = await this.prisma.course.create({
      data: {
        userId: data.userId,
        name: data.name,
        teacher: data.teacher,
        room: data.room,
        color: data.color ?? '#b0a8db',
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        weeks: data.weeks ?? [],
        location: data.location,
        icsUid: data.icsUid,
        semesterId: data.semesterId || null,
      },
    });

    // 如果有完整规则，自动生成 CalendarEvent
    if (data.dayOfWeek && data.startTime && data.endTime && data.weeks?.length) {
      await this.generateEvents(course);
    }

    return this.findOne(course.id, data.userId);
  }

  async update(id: string, userId: string, data: CourseUpdateData) {
    const existing = await this.prisma.course.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Course not found');

    const { regenerate, ...courseData } = data;
    await this.assertOwnedSemester(courseData.semesterId, userId);

    const updated = await this.prisma.course.update({
      where: { id, userId },
      data: courseData,
    });

    // 换课：重新生成 CalendarEvent（跳过 isOverride 的实例）
    if (regenerate || this.hasScheduleChange(data, existing)) {
      await this.regenerateEvents(updated);
    }

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.course.findFirstOrThrow({ where: { id, userId } });
      await tx.calendarEvent.deleteMany({ where: { courseId: id, userId } });
      return tx.course.delete({ where: { id, userId } });
    });
  }

  // ==================== 课程实例 (CalendarEvent) ====================

  async findEvents(courseId: string, userId: string) {
    await this.prisma.course.findFirstOrThrow({ where: { id: courseId, userId } });
    return this.prisma.calendarEvent.findMany({
      where: { courseId, userId },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * 调课：修改单个实例的时间/教室，标记 isOverride
   */
  async adjustEvent(eventId: string, userId: string, data: {
    startTime?: string;
    endTime?: string;
    room?: string;
    title?: string;
  }) {
    const event = await this.prisma.calendarEvent.findFirst({
      where: { id: eventId, userId },
    });
    if (!event) throw new NotFoundException('CalendarEvent not found');

    const { room, ...eventData } = data;
    const updateData: any = {
      ...eventData,
      isOverride: true,
      overrideType: event.overrideType || 'reschedule',
      overrideOriginalStart: event.overrideOriginalStart || event.startTime,
    };
    if (room !== undefined) updateData.location = room;
    if (data.startTime) updateData.startTime = new Date(data.startTime);
    if (data.endTime) updateData.endTime = new Date(data.endTime);

    return this.prisma.calendarEvent.update({
      where: { id: eventId, userId },
      data: updateData,
    });
  }

  async previewCourseChange(userId: string, data: CourseChangeRequest) {
    return this.buildCourseChangePreview(this.prisma, userId, data);
  }

  async applyCourseChange(userId: string, data: CourseChangeRequest) {
    return this.prisma.$transaction(async (tx) => {
      const preview = await this.buildCourseChangePreview(tx, userId, data);
      if (preview.conflicts.length > 0) {
        throw new ConflictException('课程变动与现有日程冲突，请重新调整后再确认');
      }

      const overrideGroupId = data.type === 'swap' ? randomUUID() : null;
      const applied: any[] = [];
      const beforeState: CourseEventState[] = [];
      const afterState: CourseEventState[] = [];

      for (const change of preview.changes) {
        if (change.action === 'create') {
          const course = await tx.course.findFirst({
            where: { id: change.courseId, userId },
          });
          if (!course || !change.to) throw new NotFoundException('Course not found');

          const created = await tx.calendarEvent.create({
            data: {
              userId,
              courseId: course.id,
              title: change.title,
              eventType: 'course',
              startTime: new Date(change.to.startTime),
              endTime: new Date(change.to.endTime),
              color: course.color,
              location: change.to.location,
              isOverride: true,
              overrideType: 'extra',
              overrideGroupId: null,
              scheduleLocked: true,
            },
          });
          beforeState.push({
            ...courseEventState(created, false),
            existed: false,
          });
          afterState.push(courseEventState(created));
          applied.push(created);
          continue;
        }

        if (!change.eventId) throw new BadRequestException('Course occurrence is missing');
        const current = await tx.calendarEvent.findFirst({
          where: { id: change.eventId, userId },
        });
        if (!current) throw new NotFoundException('CalendarEvent not found');

        beforeState.push(courseEventState(current));
        const originalStart = current.overrideOriginalStart || current.startTime;
        if (change.action === 'cancel') {
          const updated = await tx.calendarEvent.update({
            where: { id: current.id },
            data: {
              isOverride: true,
              overrideType: 'cancel',
              overrideOriginalStart: originalStart,
              overrideGroupId: null,
              scheduleLocked: true,
            },
          });
          afterState.push(courseEventState(updated));
          applied.push(updated);
          continue;
        }

        if (!change.to) throw new BadRequestException('Target occurrence is missing');
        const updated = await tx.calendarEvent.update({
          where: { id: current.id },
          data: {
            startTime: new Date(change.to.startTime),
            endTime: new Date(change.to.endTime),
            location: change.to.location,
            isOverride: true,
            overrideType: data.type === 'swap' ? 'swap' : 'reschedule',
            overrideOriginalStart: originalStart,
            overrideGroupId,
            scheduleLocked: true,
          },
        });
        afterState.push(courseEventState(updated));
        applied.push(updated);
      }

      const plan = await tx.schedulePlan.create({
        data: {
          userId,
          planType: 'course',
          status: 'applied',
          beforeState: beforeState as unknown as Prisma.InputJsonValue,
          afterState: afterState as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        planId: plan.id,
        type: data.type,
        appliedCount: applied.length,
        overrideGroupId,
        events: applied,
      };
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }

  async undoCourseChange(userId: string, planId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.schedulePlan.findFirst({
        where: { id: planId, userId },
      });
      if (!plan) throw new NotFoundException('Course change plan not found');
      if (plan.planType !== 'course') {
        throw new ConflictException('This plan is not a course change');
      }
      if (plan.status !== 'applied') {
        throw new ConflictException('Course change has already been undone');
      }

      const beforeState = readCourseEventStates(plan.beforeState);
      const afterState = readCourseEventStates(plan.afterState);
      if (!afterState.length || beforeState.length !== afterState.length) {
        throw new ConflictException('Course change history is incomplete');
      }

      const currentEvents = await tx.calendarEvent.findMany({
        where: {
          userId,
          id: { in: afterState.map((item) => item.eventId) },
        },
      });
      const currentById = new Map(currentEvents.map((event) => [event.id, event]));
      for (const expected of afterState) {
        const current = currentById.get(expected.eventId);
        if (!current || !sameCourseEventState(current, expected)) {
          throw new ConflictException(
            'A course occurrence changed after apply; undo was cancelled',
          );
        }
      }

      let restoredCount = 0;
      for (const previous of beforeState) {
        if (!previous.existed) {
          await tx.calendarEvent.delete({
            where: { id: previous.eventId, userId },
          });
          restoredCount += 1;
          continue;
        }

        await tx.calendarEvent.update({
          where: { id: previous.eventId, userId },
          data: {
            courseId: previous.courseId,
            title: previous.title,
            eventType: previous.eventType,
            startTime: new Date(previous.startTime),
            endTime: new Date(previous.endTime),
            isAllDay: previous.isAllDay,
            recurrenceRule: previous.recurrenceRule,
            isOverride: previous.isOverride,
            color: previous.color,
            location: previous.location,
            scheduleLocked: previous.scheduleLocked,
            overrideType: previous.overrideType,
            overrideOriginalStart: previous.overrideOriginalStart
              ? new Date(previous.overrideOriginalStart)
              : null,
            overrideGroupId: previous.overrideGroupId,
          },
        });
        restoredCount += 1;
      }

      await tx.schedulePlan.update({
        where: { id: plan.id },
        data: { status: 'undone' },
      });

      return { planId: plan.id, restoredCount };
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }

  async previewCourseTemplateChange(
    userId: string,
    data: CourseTemplateChangeRequest,
  ) {
    const preview = await this.buildCourseTemplatePreview(this.prisma, userId, data);
    const {
      replacedEventIds: _replacedEventIds,
      normalizedChanges: _normalizedChanges,
      ...publicPreview
    } = preview;
    return publicPreview;
  }

  async applyCourseTemplateChange(
    userId: string,
    data: CourseTemplateChangeRequest,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const preview = await this.buildCourseTemplatePreview(tx, userId, data);
      if (preview.conflicts.length > 0) {
        throw new ConflictException('课程模板修改与现有日程冲突，请调整后再确认');
      }

      const beforeEvents = preview.replacedEventIds.length
        ? await tx.calendarEvent.findMany({
            where: {
              userId,
              id: { in: preview.replacedEventIds },
              courseId: preview.courseId,
              isOverride: false,
            },
            orderBy: { startTime: 'asc' },
          })
        : [];

      if (beforeEvents.length !== preview.replacedEventIds.length) {
        throw new ConflictException('课程实例已变化，请重新生成模板预览');
      }

      const beforeState: CourseTemplatePlanState = {
        effectiveFrom: preview.effectiveFrom,
        course: preview.before,
        events: beforeEvents.map(courseTemplateEventState),
      };

      const updatedCourse = await tx.course.update({
        where: { id: preview.courseId, userId },
        data: preview.normalizedChanges,
      });

      if (preview.replacedEventIds.length) {
        await tx.calendarEvent.deleteMany({
          where: {
            userId,
            id: { in: preview.replacedEventIds },
            courseId: preview.courseId,
            isOverride: false,
          },
        });
      }

      const createdEvents: any[] = [];
      for (const occurrence of preview.generatedOccurrences) {
        createdEvents.push(await tx.calendarEvent.create({
          data: {
            userId,
            courseId: preview.courseId,
            title: updatedCourse.name,
            eventType: 'course',
            startTime: new Date(occurrence.startTime),
            endTime: new Date(occurrence.endTime),
            color: updatedCourse.color,
            location: occurrence.location,
            isOverride: false,
          },
        }));
      }

      const afterState: CourseTemplatePlanState = {
        effectiveFrom: preview.effectiveFrom,
        course: courseTemplateState(updatedCourse),
        events: createdEvents.map(courseTemplateEventState),
      };

      const plan = await tx.schedulePlan.create({
        data: {
          userId,
          planType: 'course-template',
          status: 'applied',
          beforeState: beforeState as unknown as Prisma.InputJsonValue,
          afterState: afterState as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        planId: plan.id,
        courseId: preview.courseId,
        courseName: preview.courseName,
        effectiveFrom: preview.effectiveFrom,
        replacedCount: beforeEvents.length,
        generatedCount: createdEvents.length,
      };
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }

  async undoCourseTemplateChange(userId: string, planId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.schedulePlan.findFirst({
        where: { id: planId, userId },
      });
      if (!plan) throw new NotFoundException('Course template plan not found');
      if (plan.planType !== 'course-template') {
        throw new ConflictException('This plan is not a course template change');
      }
      if (plan.status !== 'applied') {
        throw new ConflictException('Course template change has already been undone');
      }

      const beforeState = readCourseTemplatePlanState(plan.beforeState);
      const afterState = readCourseTemplatePlanState(plan.afterState);
      if (
        !beforeState ||
        !afterState ||
        beforeState.course.courseId !== afterState.course.courseId
      ) {
        throw new ConflictException('Course template history is incomplete');
      }

      const courseId = afterState.course.courseId;
      const currentCourse = await tx.course.findFirst({
        where: { id: courseId, userId },
      });
      if (!currentCourse || !sameCourseTemplateState(currentCourse, afterState.course)) {
        throw new ConflictException(
          'The course template changed after apply; undo was cancelled',
        );
      }

      const currentEvents = afterState.events.length
        ? await tx.calendarEvent.findMany({
            where: {
              userId,
              id: { in: afterState.events.map((event) => event.eventId) },
            },
          })
        : [];
      if (currentEvents.length !== afterState.events.length) {
        throw new ConflictException(
          'A generated course occurrence changed after apply; undo was cancelled',
        );
      }
      const currentById = new Map(currentEvents.map((event) => [event.id, event]));
      for (const expected of afterState.events) {
        const current = currentById.get(expected.eventId);
        if (!current || !sameCourseTemplateEventState(current, expected)) {
          throw new ConflictException(
            'A generated course occurrence changed after apply; undo was cancelled',
          );
        }
      }

      if (afterState.events.length) {
        await tx.calendarEvent.deleteMany({
          where: {
            userId,
            id: { in: afterState.events.map((event) => event.eventId) },
          },
        });
      }

      await tx.course.update({
        where: { id: courseId, userId },
        data: {
          dayOfWeek: beforeState.course.dayOfWeek,
          startTime: beforeState.course.startTime,
          endTime: beforeState.course.endTime,
          room: beforeState.course.room,
          location: beforeState.course.location,
        },
      });

      for (const event of beforeState.events) {
        await tx.calendarEvent.create({
          data: {
            id: event.eventId,
            userId,
            taskId: event.taskId,
            courseId: event.courseId,
            title: event.title,
            eventType: event.eventType,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            isAllDay: event.isAllDay,
            recurrenceRule: event.recurrenceRule,
            isOverride: event.isOverride,
            overrideType: event.overrideType,
            overrideOriginalStart: event.overrideOriginalStart
              ? new Date(event.overrideOriginalStart)
              : null,
            overrideGroupId: event.overrideGroupId,
            color: event.color,
            location: event.location,
            externalSource: event.externalSource,
            externalEventId: event.externalEventId,
            sourceCalendarTitle: event.sourceCalendarTitle,
            googleEventId: event.googleEventId,
            googleSyncedAt: event.googleSyncedAt
              ? new Date(event.googleSyncedAt)
              : null,
            syncStatus: event.syncStatus,
            scheduleLocked: event.scheduleLocked,
          },
        });
      }

      await tx.schedulePlan.update({
        where: { id: plan.id },
        data: { status: 'undone' },
      });

      return {
        planId: plan.id,
        courseId,
        restoredCount: beforeState.events.length,
      };
    }, { isolationLevel: 'Serializable', timeout: 15000 });
  }

  async listCourseChangeCandidates(userId: string, start?: string, end?: string) {
    const now = new Date();
    const rangeStart = start ? this.parseCourseChangeDate(start, 'start') : now;
    const rangeEnd = end
      ? this.parseCourseChangeDate(end, 'end')
      : new Date(rangeStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (rangeEnd <= rangeStart) throw new BadRequestException('end must be after start');

    return this.prisma.calendarEvent.findMany({
      where: {
        userId,
        courseId: { not: null },
        startTime: { gte: rangeStart, lt: rangeEnd },
      },
      orderBy: { startTime: 'asc' },
      include: {
        course: {
          select: { id: true, name: true, color: true, room: true, teacher: true },
        },
      },
    });
  }

  private async buildCourseTemplatePreview(
    db: any,
    userId: string,
    data: CourseTemplateChangeRequest,
  ) {
    if (!data?.courseId?.trim()) {
      throw new BadRequestException('courseId is required');
    }
    if (!data.changes || typeof data.changes !== 'object') {
      throw new BadRequestException('changes are required');
    }

    const effectiveFrom = this.parseCourseChangeDate(data.effectiveFrom, 'effectiveFrom');
    const course = await db.course.findFirst({
      where: { id: data.courseId, userId },
    });
    if (!course) throw new NotFoundException('Course not found');

    const normalizedChanges: CourseTemplateChanges = {};
    if (data.changes.dayOfWeek !== undefined) {
      if (
        !Number.isInteger(data.changes.dayOfWeek) ||
        data.changes.dayOfWeek < 1 ||
        data.changes.dayOfWeek > 7
      ) {
        throw new BadRequestException('dayOfWeek must be between 1 and 7');
      }
      normalizedChanges.dayOfWeek = data.changes.dayOfWeek;
    }
    if (data.changes.startTime !== undefined) {
      normalizedChanges.startTime = this.normalizeCourseClock(data.changes.startTime, 'startTime');
    }
    if (data.changes.endTime !== undefined) {
      normalizedChanges.endTime = this.normalizeCourseClock(data.changes.endTime, 'endTime');
    }
    if (data.changes.room !== undefined) {
      normalizedChanges.room = data.changes.room?.trim().slice(0, 300) || null;
    }
    if (data.changes.location !== undefined) {
      normalizedChanges.location = data.changes.location?.trim().slice(0, 300) || null;
    }
    if (!Object.keys(normalizedChanges).length) {
      throw new BadRequestException('At least one template field must change');
    }

    const afterDay = normalizedChanges.dayOfWeek ?? course.dayOfWeek;
    const afterStart = normalizedChanges.startTime ?? course.startTime;
    const afterEnd = normalizedChanges.endTime ?? course.endTime;
    const afterRoom = normalizedChanges.room !== undefined
      ? normalizedChanges.room
      : course.room;
    const afterLocation = normalizedChanges.location !== undefined
      ? normalizedChanges.location
      : course.location;

    if (!afterDay || !afterStart || !afterEnd) {
      throw new BadRequestException('Course template needs dayOfWeek, startTime and endTime');
    }
    this.assertCourseClockRange(afterStart, afterEnd);

    const before = courseTemplateState(course);
    const after: CourseTemplateState = {
      courseId: course.id,
      dayOfWeek: afterDay,
      startTime: afterStart,
      endTime: afterEnd,
      room: afterRoom || null,
      location: afterLocation || null,
    };
    if (JSON.stringify(before) === JSON.stringify(after)) {
      throw new BadRequestException('Course template has no changes');
    }

    const semester = await db.semester.findFirst({
      where: {
        userId,
        ...(course.semesterId ? { id: course.semesterId } : { isActive: true }),
      },
    });
    const semesterStart = semester?.startDate || this.getSemesterStart();
    const semesterEnd = semester?.endDate
      ? new Date(semester.endDate)
      : new Date(effectiveFrom.getTime() + 180 * 24 * 60 * 60 * 1000);
    semesterEnd.setHours(23, 59, 59, 999);

    const allCourseEvents = await db.calendarEvent.findMany({
      where: { userId, courseId: course.id },
      orderBy: { startTime: 'asc' },
    });

    let weeks = this.extractCourseWeeks(course.weeks);
    if (!weeks.length) {
      const derivedWeeks: number[] = [];
      for (const event of allCourseEvents as any[]) {
        if (event.isOverride) continue;
        const week = this.semesterWeekForDate(semesterStart, event.startTime);
        if (typeof week === 'number' && week > 0) derivedWeeks.push(week);
      }
      weeks = [...new Set<number>(derivedWeeks)].sort((a, b) => a - b);
    }

    const regularFutureEvents = allCourseEvents.filter((event: any) => (
      !event.isOverride &&
      event.startTime >= effectiveFrom
    ));
    const eligibleWeeks = new Set(
      regularFutureEvents
        .map((event: any) => this.semesterWeekForDate(semesterStart, event.startTime))
        .filter((week: number | null): week is number => Boolean(week && week > 0)),
    );
    const overrideWeeks = new Set(
      allCourseEvents
        .filter((event: any) => event.isOverride && event.overrideOriginalStart)
        .map((event: any) => this.semesterWeekForDate(semesterStart, event.overrideOriginalStart))
        .filter((week: number | null): week is number => Boolean(week && week > 0)),
    );

    const targetEntries = this.expandScheduleEntries(
      semesterStart,
      afterDay,
      afterStart,
      afterEnd,
      weeks,
    )
      .filter((entry) => (
        entry.start >= effectiveFrom &&
        entry.start <= semesterEnd &&
        entry.end <= semesterEnd &&
        eligibleWeeks.has(entry.week) &&
        !overrideWeeks.has(entry.week)
      ));

    const replacedEventIds = regularFutureEvents
      .filter((event: any) => {
        const week = this.semesterWeekForDate(semesterStart, event.startTime);
        return Boolean(week && eligibleWeeks.has(week));
      })
      .map((event: any) => event.id);

    const generatedOccurrences = targetEntries.map((entry) => ({
      week: entry.week,
      startTime: entry.start.toISOString(),
      endTime: entry.end.toISOString(),
      location: afterRoom || afterLocation || null,
    }));

    const conflicts: CourseTemplateConflict[] = [];
    if (targetEntries.length) {
      const rangeStart = targetEntries.reduce(
        (min, entry) => entry.start < min ? entry.start : min,
        targetEntries[0].start,
      );
      const rangeEnd = targetEntries.reduce(
        (max, entry) => entry.end > max ? entry.end : max,
        targetEntries[0].end,
      );
      const [events, tasks] = await Promise.all([
        db.calendarEvent.findMany({
          where: {
            userId,
            startTime: { lt: rangeEnd },
            endTime: { gt: rangeStart },
            ...(replacedEventIds.length
              ? { id: { notIn: replacedEventIds } }
              : {}),
          },
          select: {
            id: true,
            taskId: true,
            title: true,
            startTime: true,
            endTime: true,
            overrideType: true,
          },
        }),
        db.task.findMany({
          where: {
            userId,
            status: { notIn: ['done', 'cancelled'] },
            scheduledStart: { lt: rangeEnd },
            scheduledEnd: { gt: rangeStart },
          },
          select: {
            id: true,
            title: true,
            scheduledStart: true,
            scheduledEnd: true,
          },
        }),
      ]);

      const activeEvents = events.filter((event: any) => event.overrideType !== 'cancel');
      const eventTaskIds = new Set(
        activeEvents
          .map((event: any) => event.taskId)
          .filter((value: unknown): value is string => typeof value === 'string' && Boolean(value)),
      );

      targetEntries.forEach((target, occurrenceIndex) => {
        for (const event of activeEvents) {
          if (target.start < event.endTime && target.end > event.startTime) {
            conflicts.push({
              occurrenceIndex,
              sourceType: 'calendar',
              id: event.id,
              title: event.title,
              startTime: event.startTime.toISOString(),
              endTime: event.endTime.toISOString(),
            });
          }
        }
        for (const task of tasks) {
          if (
            eventTaskIds.has(task.id) ||
            !task.scheduledStart ||
            !task.scheduledEnd
          ) continue;
          if (target.start < task.scheduledEnd && target.end > task.scheduledStart) {
            conflicts.push({
              occurrenceIndex,
              sourceType: 'task',
              id: task.id,
              title: task.title,
              startTime: task.scheduledStart.toISOString(),
              endTime: task.scheduledEnd.toISOString(),
            });
          }
        }
      });
    }

    return {
      courseId: course.id,
      courseName: course.name,
      effectiveFrom: effectiveFrom.toISOString(),
      before,
      after,
      replacedEventIds,
      generatedOccurrences,
      preservedOverrideCount: allCourseEvents.filter((event: any) => event.isOverride).length,
      conflicts,
      normalizedChanges,
    };
  }

  private normalizeCourseClock(value: string, label: string) {
    const trimmed = value?.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
      throw new BadRequestException(`${label} must use HH:mm`);
    }
    return trimmed;
  }

  private assertCourseClockRange(startTime: string, endTime: string) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;
    if (endMinutes <= startMinutes) {
      throw new BadRequestException('endTime must be after startTime');
    }
    if (endMinutes - startMinutes > 12 * 60) {
      throw new BadRequestException('Course duration cannot exceed 12 hours');
    }
  }

  private extractCourseWeeks(value: unknown): number[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(
      value
        .filter((week): week is number => Number.isInteger(week) && week > 0 && week <= 80),
    )].sort((a, b) => a - b);
  }

  private semesterWeekForDate(semesterStart: Date, value: Date) {
    const start = new Date(semesterStart);
    start.setHours(0, 0, 0, 0);
    const monday = new Date(start);
    const startDow = start.getDay() || 7;
    monday.setDate(monday.getDate() - (startDow - 1));

    const target = new Date(value);
    target.setHours(0, 0, 0, 0);
    const days = Math.floor((target.getTime() - monday.getTime()) / 86_400_000);
    if (days < 0) return null;
    return Math.floor(days / 7) + 1;
  }

  private parseCourseChangeDate(value: string, label: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} is invalid`);
    return date;
  }

  private async buildCourseChangePreview(
    db: any,
    userId: string,
    data: CourseChangeRequest,
  ): Promise<{
    type: CourseChangeRequest['type'];
    changes: CourseChangePreviewItem[];
    conflicts: CourseChangeConflict[];
  }> {
    if (!data || !['reschedule', 'cancel', 'extra', 'swap'].includes(data.type)) {
      throw new BadRequestException('Unsupported course change type');
    }

    const point = (event: {
      startTime: Date;
      endTime: Date;
      location?: string | null;
    }): CourseChangePoint => ({
      startTime: event.startTime.toISOString(),
      endTime: event.endTime.toISOString(),
      location: event.location || null,
    });

    const assertRange = (start: Date, end: Date) => {
      if (end <= start) throw new BadRequestException('endTime must be after startTime');
      if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
        throw new BadRequestException('A course occurrence cannot exceed 12 hours');
      }
    };

    const changes: CourseChangePreviewItem[] = [];
    const excludeEventIds: string[] = [];

    if (data.type === 'extra') {
      const course = await db.course.findFirst({ where: { id: data.courseId, userId } });
      if (!course) throw new NotFoundException('Course not found');
      const start = this.parseCourseChangeDate(data.startTime, 'startTime');
      const end = this.parseCourseChangeDate(data.endTime, 'endTime');
      assertRange(start, end);
      changes.push({
        action: 'create',
        eventId: null,
        courseId: course.id,
        courseName: course.name,
        title: data.title?.trim().slice(0, 200) || course.name,
        from: null,
        to: {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          location: data.location?.trim() || course.room || course.location || null,
        },
      });
    } else {
      const event = await db.calendarEvent.findFirst({
        where: { id: data.eventId, userId },
        include: { course: true },
      });
      if (!event || !event.courseId || !event.course) {
        throw new NotFoundException('Course occurrence not found');
      }
      if (event.overrideType === 'cancel') {
        throw new ConflictException('This course occurrence is already cancelled');
      }
      excludeEventIds.push(event.id);

      if (data.type === 'cancel') {
        changes.push({
          action: 'cancel',
          eventId: event.id,
          courseId: event.courseId,
          courseName: event.course.name,
          title: event.title,
          from: point(event),
          to: null,
        });
      } else if (data.type === 'reschedule') {
        const start = this.parseCourseChangeDate(data.startTime, 'startTime');
        const end = this.parseCourseChangeDate(data.endTime, 'endTime');
        assertRange(start, end);
        changes.push({
          action: 'update',
          eventId: event.id,
          courseId: event.courseId,
          courseName: event.course.name,
          title: event.title,
          from: point(event),
          to: {
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            location: data.location === undefined
              ? event.location || null
              : data.location?.trim() || null,
          },
        });
      } else {
        if (data.otherEventId === event.id) {
          throw new BadRequestException('Cannot swap a course occurrence with itself');
        }
        const other = await db.calendarEvent.findFirst({
          where: { id: data.otherEventId, userId },
          include: { course: true },
        });
        if (!other || !other.courseId || !other.course) {
          throw new NotFoundException('Other course occurrence not found');
        }
        if (other.overrideType === 'cancel') {
          throw new ConflictException('The other course occurrence is cancelled');
        }
        excludeEventIds.push(other.id);

        changes.push(
          {
            action: 'update',
            eventId: event.id,
            courseId: event.courseId,
            courseName: event.course.name,
            title: event.title,
            from: point(event),
            to: {
              startTime: other.startTime.toISOString(),
              endTime: other.endTime.toISOString(),
              location: other.location || null,
            },
          },
          {
            action: 'update',
            eventId: other.id,
            courseId: other.courseId,
            courseName: other.course.name,
            title: other.title,
            from: point(other),
            to: {
              startTime: event.startTime.toISOString(),
              endTime: event.endTime.toISOString(),
              location: event.location || null,
            },
          },
        );
      }
    }

    const conflicts: CourseChangeConflict[] = [];
    for (let index = 0; index < changes.length; index += 1) {
      const target = changes[index].to;
      if (!target) continue;
      const start = new Date(target.startTime);
      const end = new Date(target.endTime);

      const [events, tasks] = await Promise.all([
        db.calendarEvent.findMany({
          where: {
            userId,
            startTime: { lt: end },
            endTime: { gt: start },
            ...(excludeEventIds.length ? { id: { notIn: excludeEventIds } } : {}),
          },
          select: {
            id: true,
            taskId: true,
            title: true,
            startTime: true,
            endTime: true,
            overrideType: true,
          },
        }),
        db.task.findMany({
          where: {
            userId,
            status: { notIn: ['done', 'cancelled'] },
            scheduledStart: { lt: end },
            scheduledEnd: { gt: start },
          },
          select: {
            id: true,
            title: true,
            scheduledStart: true,
            scheduledEnd: true,
          },
        }),
      ]);

      const activeEvents = events.filter((item: { overrideType?: string | null }) => item.overrideType !== 'cancel');
      const eventTaskIds = new Set(
        activeEvents
          .map((item: { taskId?: string | null }) => item.taskId)
          .filter((value: string | null | undefined): value is string => Boolean(value)),
      );

      for (const item of activeEvents) {
        conflicts.push({
          changeIndex: index,
          sourceType: 'calendar',
          id: item.id,
          title: item.title,
          startTime: item.startTime.toISOString(),
          endTime: item.endTime.toISOString(),
        });
      }
      for (const item of tasks) {
        if (eventTaskIds.has(item.id) || !item.scheduledStart || !item.scheduledEnd) continue;
        conflicts.push({
          changeIndex: index,
          sourceType: 'task',
          id: item.id,
          title: item.title,
          startTime: item.scheduledStart.toISOString(),
          endTime: item.scheduledEnd.toISOString(),
        });
      }
    }

    return { type: data.type, changes, conflicts };
  }

  // ==================== 课程任务（兼容既有 notes 路径） ====================

  async findNotes(courseId: string, userId: string) {
    return this.prisma.courseNote.findMany({
      where: { courseId, userId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      include: { images: courseNoteImages },
    });
  }

  async createNote(data: NoteData) {
    const course = await this.prisma.course.findFirst({ where: { id: data.courseId, userId: data.userId }, select: { id: true } });
    if (!course) throw new NotFoundException('Course not found');
    return this.prisma.courseNote.create({ data, include: { images: courseNoteImages } });
  }

  async updateNote(id: string, userId: string, data: { body?: string; pinned?: boolean }) {
    const note = await this.prisma.courseNote.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('Course task not found');
    return this.prisma.courseNote.update({ where: { id, userId }, data, include: { images: courseNoteImages } });
  }

  async deleteNote(id: string, userId: string) {
    const note = await this.prisma.courseNote.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('Course task not found');
    return this.prisma.courseNote.delete({ where: { id, userId } });
  }

  // ==================== 内部方法 ====================

  private async assertOwnedSemester(semesterId: string | undefined, userId: string) {
    if (!semesterId) return;
    const semester = await this.prisma.semester.findFirst({ where: { id: semesterId, userId }, select: { id: true } });
    if (!semester) throw new NotFoundException('Semester not found');
  }

  /**
   * 根据 Course 规则模板生成所有 CalendarEvent 实例
   */
  private async generateEvents(course: any) {
    if (!course.dayOfWeek || !course.startTime || !course.endTime) return;

    const semesterStart = await this.getCourseSemesterStart(course);
    const instances = this.expandSchedule(
      semesterStart,
      course.dayOfWeek,
      course.startTime,
      course.endTime,
      course.weeks,
      course.room,
    );

    const semester = await this.prisma.semester.findFirst({ where: {
      userId: course.userId,
      ...(course.semesterId ? { id: course.semesterId } : { isActive: true }),
    } });
    const semesterLastDay = semester ? new Date(semester.endDate) : null;
    semesterLastDay?.setHours(23, 59, 59, 999);
    const boundedInstances = semester && semesterLastDay
      ? instances.filter(inst => inst.start >= semester.startDate && inst.end <= semesterLastDay)
      : instances;

    const overrides = await this.prisma.calendarEvent.findMany({
      where: {
        courseId: course.id,
        userId: course.userId,
        isOverride: true,
        overrideOriginalStart: { not: null },
      },
      select: { overrideOriginalStart: true },
    });
    const suppressedStarts = new Set(
      overrides
        .map((event) => event.overrideOriginalStart?.getTime())
        .filter((value): value is number => typeof value === 'number'),
    );
    const generatedInstances = boundedInstances.filter(
      (inst) => !suppressedStarts.has(inst.start.getTime()),
    );

    // 批量创建；已存在单次 override 的原 occurrence 不再重新生成。
    await this.prisma.calendarEvent.createMany({
      data: generatedInstances.map((inst) => ({
        userId: course.userId,
        courseId: course.id,
        title: course.name,
        eventType: 'course',
        startTime: inst.start,
        endTime: inst.end,
        color: course.color,
        location: course.room || course.location,
        isOverride: false,
      })),
    });
  }

  /**
   * 换课：删除非覆盖实例，重新生成
   */
  private async regenerateEvents(course: any) {
    // 删除非覆盖的旧事件
    await this.prisma.calendarEvent.deleteMany({
      where: { courseId: course.id, isOverride: false },
    });

    // 重新生成
    await this.generateEvents(course);
  }

  /**
   * 展开学期范围内的课程实例
   */
  private expandScheduleEntries(
    semesterStart: Date,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    weeks: number[],
  ) {
    const instances: { week: number; start: Date; end: Date }[] = [];
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    const start = new Date(semesterStart);
    const monday = new Date(start);
    const startDow = start.getDay() || 7;
    if (startDow !== 1) {
      monday.setDate(monday.getDate() - (startDow - 1));
    }

    for (const week of weeks) {
      const date = new Date(monday);
      date.setDate(date.getDate() + (week - 1) * 7 + (dayOfWeek - 1));
      date.setHours(sh, sm, 0, 0);
      const end = new Date(date);
      end.setHours(eh, em, 0, 0);
      instances.push({ week, start: new Date(date), end: new Date(end) });
    }

    return instances;
  }

  private expandSchedule(
    semesterStart: Date,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    weeks: number[],
    room?: string,
  ) {
    return this.expandScheduleEntries(
      semesterStart,
      dayOfWeek,
      startTime,
      endTime,
      weeks,
    ).map(({ start, end }) => ({ start, end }));
  }

  /**
   * 检测更新是否涉及排课规则变化
   */
  private hasScheduleChange(data: CourseUpdateData, existing: any): boolean {
    return !!(
      (data.dayOfWeek !== undefined && data.dayOfWeek !== existing.dayOfWeek) ||
      (data.startTime !== undefined && data.startTime !== existing.startTime) ||
      (data.endTime !== undefined && data.endTime !== existing.endTime) ||
      (data.weeks !== undefined && JSON.stringify(data.weeks) !== JSON.stringify(existing.weeks)) ||
      (data.room !== undefined && data.room !== existing.room)
    );
  }

  /**
   * 获取学期起始日（默认上周一，可后续改为配置驱动）
   */
  private getSemesterStart(): Date {
    const now = new Date();
    const dow = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - (dow - 1));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  /**
   * 获取课程对应学期的起始日
   * 优先 semesterId → 再查 isActive 学期 → 兜底上周一
   */
  private async getCourseSemesterStart(course: any): Promise<Date> {
    if (course.semesterId) {
      const semester = await this.prisma.semester.findUnique({
        where: { id: course.semesterId },
      });
      if (semester) return semester.startDate;
    }
    const activeSemester = await this.prisma.semester.findFirst({
      where: { userId: course.userId, isActive: true },
    });
    if (activeSemester) return activeSemester.startDate;
    return this.getSemesterStart();
  }

  // ==================== ICS 文件导入 ====================

  async importFromIcs(
    fileBuffer: Buffer,
    userId: string,
    options?: {
      semesterId?: string;
      semesterStart?: string;
      semesterEnd?: string;
      excludeCourses?: string[];
      colorMap?: Record<string, string>;
    },
  ) {
    // 将 buffer 写入临时文件（node-ical 只支持文件路径）
    const tmpDir = os.tmpdir();
    const tmpPath = path.join(tmpDir, `course-import-${Date.now()}.ics`);
    fs.writeFileSync(tmpPath, fileBuffer);

    let events: any;
    try {
      events = await ical.async.parseFile(tmpPath);
    } catch (err: any) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      throw new Error(`ICS 解析失败: ${err.message}`);
    }

    // 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

    const excludeSet = new Set(options?.excludeCourses || []);

    // ── 展开 RRULE，收集所有实际课程实例 ──
    const rawInstances: { summary: string; start: Date; end: Date; location: string; uid: string }[] = [];

    for (const [, ev] of Object.entries(events)) {
      if ((ev as any).type !== 'VEVENT') continue;
      const summary = (ev as any).summary?.trim();
      if (!summary || excludeSet.has(summary)) continue;

      const location = (ev as any).location || '';
      const uid = (ev as any).uid || '';
      const duration = (ev as any).end.getTime() - (ev as any).start.getTime();

      if ((ev as any).rrule) {
        // 展开 RRULE：为每个重复实例生成 start/end
        const allStarts: Date[] = (ev as any).rrule.all();
        for (const start of allStarts) {
          rawInstances.push({
            summary,
            start,
            end: new Date(start.getTime() + duration),
            location,
            uid,
          });
        }
      } else {
        rawInstances.push({
          summary,
          start: (ev as any).start,
          end: (ev as any).end,
          location,
          uid,
        });
      }
    }

    // ── 自动推断学期日期范围（未提供时从实例中取最早/最晚日期） ──
    let semesterEnd: Date | null = options?.semesterEnd ? new Date(options.semesterEnd) : null;
    let semesterStart: string = options?.semesterStart || (() => {
      // 从实例中推断最早日期作为学期开始
      if (rawInstances.length === 0) return '2025-03-03';
      let earliest = rawInstances[0].start;
      for (const inst of rawInstances) {
        if (inst.start < earliest) earliest = inst.start;
      }
      return earliest.toISOString().split('T')[0];
    })();

    if (!semesterEnd) {
      // 从实例中推断最晚日期 + 1 周缓冲作为学期结束
      let latest = rawInstances[0]?.end ?? new Date();
      for (const inst of rawInstances) {
        if (inst.end > latest) latest = inst.end;
      }
      semesterEnd = new Date(latest);
      semesterEnd.setDate(semesterEnd.getDate() + 7);
    }

    const semesterMonday = this.getMonday(new Date(semesterStart + 'T00:00:00'));

    // ── 确定 semesterId：传参 → 自动匹配 → 自动创建 ──
    let semesterId = options?.semesterId || null;

    if (!semesterId && semesterEnd) {
      const matched = await this.prisma.semester.findFirst({
        where: {
          userId,
          startDate: { lte: semesterMonday },
          endDate: { gte: semesterEnd },
        },
        orderBy: { startDate: 'desc' },
      });
      if (matched) {
        semesterId = matched.id;
      } else {
        const startStr = semesterMonday.toISOString().split('T')[0];
        const endStr = semesterEnd.toISOString().split('T')[0];
        const weeks = Math.ceil(
          (semesterEnd.getTime() - semesterMonday.getTime()) / (7 * 24 * 60 * 60 * 1000),
        );
        const newSemester = await this.prisma.semester.create({
          data: {
            userId,
            name: `${startStr} ~ ${endStr} 学期`,
            startDate: semesterMonday,
            endDate: semesterEnd,
            weeks,
          },
        });
        semesterId = newSemester.id;
      }
    }

    // ── 按课程名分组（应用日期范围过滤） ──
    const courseMap = new Map<string, { instances: { start: Date; end: Date }[]; location: string; uid: string }>();

    for (const inst of rawInstances) {
      if (inst.start < semesterMonday || inst.start > semesterEnd) continue;

      if (!courseMap.has(inst.summary)) {
        courseMap.set(inst.summary, { instances: [], location: '', uid: inst.uid });
      }
      const course = courseMap.get(inst.summary)!;
      course.instances.push({ start: inst.start, end: inst.end });
      if (!course.location && inst.location) {
        course.location = inst.location;
      }
      if (!course.uid && inst.uid) {
        course.uid = inst.uid;
      }
    }

    const results: { created: string[]; updated: string[]; eventCount: number; semesterId?: string } = {
      created: [],
      updated: [],
      eventCount: 0,
      semesterId: semesterId || undefined,
    };

    for (const [courseName, data] of courseMap.entries()) {
      const instances = data.instances;
      if (instances.length === 0) continue;

      const first = instances[0];
      const startTime = this.formatTime(first.start);
      const endTime = this.formatTime(first.end);
      const dayOfWeek = this.getDayOfWeek(first.start);

      const weeks = instances
        .map((inst) => this.getWeekNumber(inst.start, semesterMonday))
        .filter((w) => w > 0)
        .sort((a, b) => a - b);
      const uniqueWeeks = [...new Set(weeks)];

      const color = options?.colorMap?.[courseName] || '#b0a8db';

      // 幂等：通过名称匹配已有课程
      const existing = await this.prisma.course.findFirst({
        where: { userId, name: courseName },
      });

      let course: any;
      if (existing) {
        course = await this.prisma.course.update({
          where: { id: existing.id },
          data: {
            semesterId: semesterId || undefined,
            dayOfWeek, startTime, endTime,
            weeks: uniqueWeeks,
            room: data.location || undefined,
            location: data.location || undefined,
            color,
            icsUid: data.uid || undefined,
          },
        });
        await this.prisma.calendarEvent.deleteMany({
          where: { courseId: course.id, isOverride: false },
        });
        results.updated.push(courseName);
      } else {
        course = await this.prisma.course.create({
          data: {
            userId, name: courseName,
            semesterId: semesterId || null,
            room: data.location || null,
            location: data.location || null,
            color, dayOfWeek, startTime, endTime,
            weeks: uniqueWeeks,
            icsUid: data.uid || null,
          },
        });
        results.created.push(courseName);
      }

      // 批量创建 CalendarEvent
      const BATCH_SIZE = 100;
      const eventData = instances.map((inst) => ({
        userId,
        courseId: course.id,
        title: courseName,
        eventType: 'course',
        startTime: inst.start,
        endTime: inst.end,
        color,
        isOverride: false,
      }));

      for (let i = 0; i < eventData.length; i += BATCH_SIZE) {
        const batch = eventData.slice(i, i + BATCH_SIZE);
        await this.prisma.calendarEvent.createMany({ data: batch });
      }
      results.eventCount += eventData.length;
    }

    return results;
  }

  // ==================== ICS 导入工具函数 ====================

  /** 将 UTC Date 转为 CST（北京时间）后再格式化时间字符串 */
  private formatTime(date: Date): string {
    // node-ical 返回 UTC 时间，课程是 CST 时区 (UTC+8)
    const localH = (date.getUTCHours() + 8) % 24;
    const localM = date.getUTCMinutes();
    return `${localH.toString().padStart(2, '0')}:${localM.toString().padStart(2, '0')}`;
  }

  private getMonday(d: Date): Date {
    const m = new Date(d);
    const dow = m.getDay() || 7;
    if (dow !== 1) m.setDate(m.getDate() - (dow - 1));
    m.setHours(0, 0, 0, 0);
    return m;
  }

  private getWeekNumber(date: Date, semesterMonday: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const diffMs = d.getTime() - semesterMonday.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  }

  /** 返回 CST（中国时间）下的星期几（1=周一，7=周日） */
  private getDayOfWeek(date: Date): number {
    // node-ical 返回 UTC 时间，+8h 偏移得到 CST 对应的星期
    const localDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const dow = localDate.getUTCDay();
    return dow === 0 ? 7 : dow;
  }
}
