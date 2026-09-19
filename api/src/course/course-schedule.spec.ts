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

});
