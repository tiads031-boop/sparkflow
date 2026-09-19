import { CourseService } from './course.service';
import { PrismaService } from '../prisma/prisma.service';

describe('course schedule integration with existing event model', () => {
  it('maps adjusted rooms to CalendarEvent.location and preserves original occurrence metadata', async () => {
    const originalStart = new Date('2026-09-21T08:00:00.000Z');
    const prisma = {
      calendarEvent: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'e',
          startTime: originalStart,
          overrideType: null,
          overrideOriginalStart: null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new CourseService(prisma as unknown as PrismaService);
    await service.adjustEvent('e', 'u', { room: 'B202' });
    expect(prisma.calendarEvent.update).toHaveBeenCalledWith({
      where: { id: 'e', userId: 'u' },
      data: {
        location: 'B202',
        isOverride: true,
        overrideType: 'reschedule',
        overrideOriginalStart: originalStart,
      },
    });
  });
  it('does not create reminder source events outside semester boundaries', async () => {
    const semester = { startDate: new Date(2026, 8, 9), endDate: new Date(2026, 8, 20) };
    const course = { id: 'c', userId: 'u', semesterId: 's', name: '数学', dayOfWeek: 1, startTime: '08:00', endTime: '09:40', weeks: [1, 2, 3], room: 'A101', color: '#cae393' };
    const prisma = {
      course: { create: jest.fn().mockResolvedValue(course), findFirst: jest.fn().mockResolvedValue(course) },
      semester: { findUnique: jest.fn().mockResolvedValue(semester), findFirst: jest.fn().mockResolvedValue(semester) },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    await new CourseService(prisma as unknown as PrismaService).create(course);
    const data = prisma.calendarEvent.createMany.mock.calls[0][0].data;
    expect(data).toHaveLength(1);
    expect(data[0].startTime).toEqual(new Date(2026, 8, 14, 8));
    expect(data[0].location).toBe('A101');
  });

  it('previews a one-off reschedule without mutating the recurring course template', async () => {
    const original = {
      id: 'e1',
      userId: 'u',
      courseId: 'c1',
      title: '民法',
      startTime: new Date('2026-09-22T01:00:00.000Z'),
      endTime: new Date('2026-09-22T02:30:00.000Z'),
      location: 'A101',
      overrideType: null,
      course: { id: 'c1', name: '民法' },
    };
    const prisma = {
      calendarEvent: {
        findFirst: jest.fn().mockResolvedValue(original),
        findMany: jest.fn().mockResolvedValue([]),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    const preview = await service.previewCourseChange('u', {
      type: 'reschedule',
      eventId: 'e1',
      startTime: '2026-09-23T03:00:00.000Z',
      endTime: '2026-09-23T04:30:00.000Z',
      location: 'B202',
    });

    expect(preview.conflicts).toEqual([]);
    expect(preview.changes).toEqual([
      expect.objectContaining({
        action: 'update',
        eventId: 'e1',
        courseId: 'c1',
        from: expect.objectContaining({
          startTime: '2026-09-22T01:00:00.000Z',
          location: 'A101',
        }),
        to: expect.objectContaining({
          startTime: '2026-09-23T03:00:00.000Z',
          location: 'B202',
        }),
      }),
    ]);
  });

  it('does not treat the two source occurrences as swap conflicts but reports third-party conflicts', async () => {
    const first = {
      id: 'e1',
      userId: 'u',
      courseId: 'c1',
      title: '民法',
      startTime: new Date('2026-09-22T01:00:00.000Z'),
      endTime: new Date('2026-09-22T02:30:00.000Z'),
      location: 'A101',
      overrideType: null,
      course: { id: 'c1', name: '民法' },
    };
    const second = {
      id: 'e2',
      userId: 'u',
      courseId: 'c2',
      title: '刑法',
      startTime: new Date('2026-09-23T03:00:00.000Z'),
      endTime: new Date('2026-09-23T04:30:00.000Z'),
      location: 'B202',
      overrideType: null,
      course: { id: 'c2', name: '刑法' },
    };
    const third = {
      id: 'e3',
      taskId: null,
      title: '会议',
      startTime: new Date('2026-09-23T03:15:00.000Z'),
      endTime: new Date('2026-09-23T03:45:00.000Z'),
      overrideType: null,
    };
    const prisma = {
      calendarEvent: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(first)
          .mockResolvedValueOnce(second),
        findMany: jest.fn()
          .mockResolvedValueOnce([third])
          .mockResolvedValueOnce([]),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    const preview = await service.previewCourseChange('u', {
      type: 'swap',
      eventId: 'e1',
      otherEventId: 'e2',
    });

    expect(preview.changes).toHaveLength(2);
    expect(preview.conflicts).toEqual([
      expect.objectContaining({
        sourceType: 'calendar',
        id: 'e3',
        changeIndex: 0,
      }),
    ]);
    expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { notIn: ['e1', 'e2'] },
      }),
      select: expect.any(Object),
    });
  });

  it('suppresses a generated recurring occurrence when an override owns its original start', async () => {
    const semester = {
      startDate: new Date(2026, 8, 7),
      endDate: new Date(2026, 8, 30),
    };
    const course = {
      id: 'c',
      userId: 'u',
      semesterId: 's',
      name: '民法',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:30',
      weeks: [1, 2],
      room: 'A101',
      color: '#cae393',
    };
    const overriddenOriginal = new Date(2026, 8, 7, 8, 0, 0, 0);
    const prisma = {
      course: {
        create: jest.fn().mockResolvedValue(course),
        findFirst: jest.fn().mockResolvedValue(course),
      },
      semester: {
        findUnique: jest.fn().mockResolvedValue(semester),
        findFirst: jest.fn().mockResolvedValue(semester),
      },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([
          { overrideOriginalStart: overriddenOriginal },
        ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await new CourseService(prisma as unknown as PrismaService).create(course);
    const data = prisma.calendarEvent.createMany.mock.calls[0][0].data;

    expect(data).toHaveLength(1);
    expect(data[0].startTime).toEqual(new Date(2026, 8, 14, 8, 0, 0, 0));
  });


  it('undoes an extra course occurrence only while the saved after-state still matches', async () => {
    const current = {
      id: 'extra-1',
      userId: 'u',
      courseId: 'c1',
      title: '民法补课',
      eventType: 'course',
      startTime: new Date('2026-09-25T01:00:00.000Z'),
      endTime: new Date('2026-09-25T02:30:00.000Z'),
      isAllDay: false,
      recurrenceRule: null,
      isOverride: true,
      color: '#cae393',
      location: 'A101',
      scheduleLocked: true,
      overrideType: 'extra',
      overrideOriginalStart: null,
      overrideGroupId: null,
    };
    const before = [{
      eventId: 'extra-1',
      existed: false,
      courseId: 'c1',
      title: '民法补课',
      eventType: 'course',
      startTime: '2026-09-25T01:00:00.000Z',
      endTime: '2026-09-25T02:30:00.000Z',
      isAllDay: false,
      recurrenceRule: null,
      isOverride: true,
      color: '#cae393',
      location: 'A101',
      scheduleLocked: true,
      overrideType: 'extra',
      overrideOriginalStart: null,
      overrideGroupId: null,
    }];
    const after = [{ ...before[0], existed: true }];
    const tx = {
      schedulePlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'plan-1',
          userId: 'u',
          planType: 'course',
          status: 'applied',
          beforeState: before,
          afterState: after,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([current]),
        delete: jest.fn().mockResolvedValue(current),
        update: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    await expect(service.undoCourseChange('u', 'plan-1')).resolves.toEqual({
      planId: 'plan-1',
      restoredCount: 1,
    });
    expect(tx.calendarEvent.delete).toHaveBeenCalledWith({
      where: { id: 'extra-1', userId: 'u' },
    });
    expect(tx.schedulePlan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { status: 'undone' },
    });
  });


  it('previews recurring template changes only for future ordinary occurrences and preserves overrides', async () => {
    const semester = {
      startDate: new Date(2026, 8, 7),
      endDate: new Date(2026, 8, 30),
    };
    const course = {
      id: 'c-template',
      userId: 'u',
      semesterId: 's',
      name: '民法',
      dayOfWeek: 1,
      startTime: '08:00',
      endTime: '09:30',
      weeks: [1, 2, 3],
      room: 'A101',
      location: null,
      color: '#cae393',
    };
    const allCourseEvents = [
      {
        id: 'week-1',
        courseId: course.id,
        startTime: new Date(2026, 8, 7, 8),
        endTime: new Date(2026, 8, 7, 9, 30),
        isOverride: false,
        overrideOriginalStart: null,
      },
      {
        id: 'week-2',
        courseId: course.id,
        startTime: new Date(2026, 8, 14, 8),
        endTime: new Date(2026, 8, 14, 9, 30),
        isOverride: false,
        overrideOriginalStart: null,
      },
      {
        id: 'week-3-override',
        courseId: course.id,
        startTime: new Date(2026, 8, 23, 13),
        endTime: new Date(2026, 8, 23, 14, 30),
        isOverride: true,
        overrideType: 'reschedule',
        overrideOriginalStart: new Date(2026, 8, 21, 8),
      },
    ];
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue(course),
      },
      semester: {
        findFirst: jest.fn().mockResolvedValue(semester),
      },
      calendarEvent: {
        findMany: jest.fn()
          .mockResolvedValueOnce(allCourseEvents)
          .mockResolvedValueOnce([]),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CourseService(prisma as unknown as PrismaService);
    const effectiveFrom = new Date(2026, 8, 8, 0, 0, 0, 0);

    const preview = await service.previewCourseTemplateChange('u', {
      courseId: course.id,
      effectiveFrom: effectiveFrom.toISOString(),
      changes: {
        dayOfWeek: 5,
        startTime: '10:00',
        endTime: '11:40',
        room: 'B202',
      },
    });

    expect(preview.before).toEqual(expect.objectContaining({
      dayOfWeek: 1,
      startTime: '08:00',
      room: 'A101',
    }));
    expect(preview.after).toEqual(expect.objectContaining({
      dayOfWeek: 5,
      startTime: '10:00',
      endTime: '11:40',
      room: 'B202',
    }));
    expect(preview.generatedOccurrences).toEqual([
      expect.objectContaining({
        week: 2,
        startTime: new Date(2026, 8, 18, 10).toISOString(),
        endTime: new Date(2026, 8, 18, 11, 40).toISOString(),
        location: 'B202',
      }),
    ]);
    expect(preview.preservedOverrideCount).toBe(1);
    expect(preview.conflicts).toEqual([]);
  });

  it('refuses template undo when a generated occurrence changed after apply', async () => {
    const templateCourse = {
      id: 'c-template',
      userId: 'u',
      dayOfWeek: 5,
      startTime: '10:00',
      endTime: '11:40',
      room: 'B202',
      location: null,
    };
    const afterEventState = {
      eventId: 'generated-1',
      taskId: null,
      courseId: 'c-template',
      title: '民法',
      eventType: 'course',
      startTime: '2026-09-18T02:00:00.000Z',
      endTime: '2026-09-18T03:40:00.000Z',
      isAllDay: false,
      recurrenceRule: null,
      isOverride: false,
      overrideType: null,
      overrideOriginalStart: null,
      overrideGroupId: null,
      color: '#cae393',
      location: 'B202',
      externalSource: null,
      externalEventId: null,
      sourceCalendarTitle: null,
      googleEventId: null,
      googleSyncedAt: null,
      syncStatus: 'pending',
      scheduleLocked: false,
    };
    const beforeState = {
      effectiveFrom: '2026-09-08T00:00:00.000Z',
      course: {
        courseId: 'c-template',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:30',
        room: 'A101',
        location: null,
      },
      events: [],
    };
    const afterState = {
      effectiveFrom: '2026-09-08T00:00:00.000Z',
      course: {
        courseId: 'c-template',
        dayOfWeek: 5,
        startTime: '10:00',
        endTime: '11:40',
        room: 'B202',
        location: null,
      },
      events: [afterEventState],
    };
    const tx = {
      schedulePlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-plan',
          userId: 'u',
          planType: 'course-template',
          status: 'applied',
          beforeState,
          afterState,
        }),
      },
      course: {
        findFirst: jest.fn().mockResolvedValue(templateCourse),
        update: jest.fn(),
      },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'generated-1',
          userId: 'u',
          taskId: null,
          courseId: 'c-template',
          title: '民法',
          eventType: 'course',
          startTime: new Date(afterEventState.startTime),
          endTime: new Date(afterEventState.endTime),
          isAllDay: false,
          recurrenceRule: null,
          isOverride: true,
          overrideType: 'reschedule',
          overrideOriginalStart: new Date(afterEventState.startTime),
          overrideGroupId: null,
          color: '#cae393',
          location: 'C303',
          externalSource: null,
          externalEventId: null,
          sourceCalendarTitle: null,
          googleEventId: null,
          googleSyncedAt: null,
          syncStatus: 'pending',
          scheduleLocked: false,
        }]),
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    await expect(
      service.undoCourseTemplateChange('u', 'template-plan'),
    ).rejects.toThrow('generated course occurrence changed after apply');
    expect(tx.calendarEvent.deleteMany).not.toHaveBeenCalled();
    expect(tx.course.update).not.toHaveBeenCalled();
  });

});
