import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseCourseImport } from './course-import';
import { CourseService } from './course.service';

const request = () => ({
  format: 'sparkflow-course-import',
  version: 2,
  requestId: 'import-20260915-service',
  targetSemesterId: 'semester-1',
  duplicatePolicy: 'skip',
  source: {
    schoolId: 'school-1',
    adapterId: 'zf-v9',
    system: 'zf-v9',
    termId: '2026-2027-1',
  },
  backup: {
    format: 'sparkflow-courses',
    version: 1,
    semesters: [
      {
        id: 'source-semester',
        name: '秋季',
        startDate: '2026-09-07T00:00:00Z',
        endDate: '2027-01-10T00:00:00Z',
      },
    ],
    courses: [
      {
        name: '数学',
        teacher: '张老师',
        room: 'A101',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '09:40',
        weeks: [1, 2],
        sourceEntryId: 'class-1',
        events: [
          {
            title: '数学',
            startTime: '2026-09-07T00:00:00Z',
            endTime: '2026-09-07T01:40:00Z',
          },
        ],
      },
    ],
  },
});

const payloadHash = () => parseCourseImport(request()).payloadHash;

const appliedBatch = () => ({
  status: 'applied',
  payloadHash: payloadHash(),
  result: {
    requestId: 'import-20260915-service',
    targetSemesterId: 'semester-1',
    courseCount: 1,
    eventCount: 2,
  },
});

describe('course import service', () => {
  it('skips an existing source entry and records an applied batch atomically', async () => {
    const batchUpdate = jest.fn().mockResolvedValue({});
    const tx = {
      courseImportBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: batchUpdate,
      },
      semester: {
        findFirst: jest.fn().mockResolvedValue({ id: 'semester-1' }),
      },
      course: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'existing-1',
            name: '数学',
            teacher: '张老师',
            room: 'A101',
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '09:40',
            weeks: [1, 2],
            sourceEntryId: 'class-1',
          },
        ]),
        create: jest.fn(),
      },
      calendarEvent: { createMany: jest.fn() },
    };
    const prisma = {
      courseImportBatch: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    const result = await new CourseService(
      prisma as unknown as PrismaService,
    ).importSchedule('user-1', request());

    expect(result).toMatchObject({
      targetSemesterId: 'semester-1',
      courseCount: 0,
      eventCount: 0,
      skippedCount: 1,
      replayed: false,
    });
    expect(tx.course.create).not.toHaveBeenCalled();
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'batch-1' },
        data: expect.objectContaining({
          status: 'applied',
          targetSemesterId: 'semester-1',
        }),
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
  });

  it('returns an applied result without opening another transaction', async () => {
    const firstLookup = jest.fn().mockResolvedValue(appliedBatch());
    const prisma = {
      courseImportBatch: { findUnique: firstLookup },
      $transaction: jest.fn(),
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    await expect(
      service.importSchedule('user-1', request()),
    ).resolves.toMatchObject({
      requestId: 'import-20260915-service',
      courseCount: 1,
      replayed: true,
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects reuse of a request ID with a different payload', async () => {
    const prisma = {
      courseImportBatch: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'applied',
          payloadHash: 'different',
          result: {},
        }),
      },
      $transaction: jest.fn(),
    };
    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not start a second write while the same request is still applying', async () => {
    const prisma = {
      courseImportBatch: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'applying',
          payloadHash: payloadHash(),
          result: null,
        }),
      },
      $transaction: jest.fn(),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recovers a concurrent request race by replaying the committed batch', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(appliedBatch());
    const prisma = {
      courseImportBatch: { findUnique },
      $transaction: jest.fn().mockRejectedValue(new Error('unique request race')),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).resolves.toMatchObject({
      requestId: 'import-20260915-service',
      courseCount: 1,
      replayed: true,
    });
    expect(findUnique).toHaveBeenNthCalledWith(1, {
      where: {
        userId_requestId: {
          userId: 'user-1',
          requestId: 'import-20260915-service',
        },
      },
    });
    expect(findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        userId_requestId: {
          userId: 'user-1',
          requestId: 'import-20260915-service',
        },
      },
    });
  });

  it('rejects a target semester that is not owned by the current user', async () => {
    const batchUpdate = jest.fn();
    const courseFindMany = jest.fn();
    const tx = {
      courseImportBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: batchUpdate,
      },
      semester: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      course: {
        findMany: courseFindMany,
        create: jest.fn(),
      },
      calendarEvent: { createMany: jest.fn() },
    };
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      courseImportBatch: { findUnique },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-2',
        request(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.semester.findFirst).toHaveBeenCalledWith({
      where: { id: 'semester-1', userId: 'user-2' },
      select: { id: true },
    });
    expect(courseFindMany).not.toHaveBeenCalled();
    expect(batchUpdate).not.toHaveBeenCalled();
  });

  it('does not mark an import applied when a course write fails', async () => {
    const writeError = new Error('course write failed');
    const batchUpdate = jest.fn();
    const tx = {
      courseImportBatch: {
        create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
        update: batchUpdate,
      },
      semester: {
        findFirst: jest.fn().mockResolvedValue({ id: 'semester-1' }),
      },
      course: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockRejectedValue(writeError),
      },
      calendarEvent: { createMany: jest.fn() },
    };
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = {
      courseImportBatch: { findUnique },
      $transaction: jest.fn((callback) => callback(tx)),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).rejects.toBe(writeError);
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('scopes import result lookup to the authenticated user', async () => {
    const createdAt = new Date('2026-09-17T00:00:00Z');
    const updatedAt = new Date('2026-09-17T00:01:00Z');
    const findUnique = jest.fn().mockResolvedValue({
      requestId: 'import-20260915-service',
      status: 'applied',
      payloadHash: payloadHash(),
      targetSemesterId: 'semester-1',
      result: appliedBatch().result,
      createdAt,
      updatedAt,
    });
    const prisma = {
      courseImportBatch: { findUnique },
    };
    const service = new CourseService(prisma as unknown as PrismaService);

    await expect(
      service.getScheduleImport('user-2', 'import-20260915-service'),
    ).resolves.toMatchObject({
      requestId: 'import-20260915-service',
      status: 'applied',
      targetSemesterId: 'semester-1',
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        userId_requestId: {
          userId: 'user-2',
          requestId: 'import-20260915-service',
        },
      },
    });
  });
});
