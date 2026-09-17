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
      expect.objectContaining({
        timeout: 30000,
        isolationLevel: 'Serializable',
      }),
    );
  });

  it('returns an applied result without opening another transaction', async () => {
    const firstLookup = jest.fn().mockResolvedValue({
      status: 'applied',
      payloadHash: parseCourseImport(request()).payloadHash,
      result: {
        requestId: 'import-20260915-service',
        courseCount: 1,
        eventCount: 2,
      },
    });
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

  it('does not replay a batch that has not reached the applied state', async () => {
    const prisma = {
      courseImportBatch: {
        findUnique: jest.fn().mockResolvedValue({
          status: 'applying',
          payloadHash: parseCourseImport(request()).payloadHash,
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
    ).rejects.toThrow('导入仍在处理中，请先查询导入结果');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('recovers a committed competing import after a transaction race', async () => {
    const applied = {
      status: 'applied',
      payloadHash: parseCourseImport(request()).payloadHash,
      result: {
        requestId: 'import-20260915-service',
        targetSemesterId: 'semester-1',
        courseCount: 1,
        eventCount: 2,
        skippedCount: 0,
      },
    };
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(applied);
    const prisma = {
      courseImportBatch: { findUnique },
      $transaction: jest.fn().mockRejectedValue(new Error('unique race')),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).resolves.toMatchObject({
      requestId: 'import-20260915-service',
      targetSemesterId: 'semester-1',
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

  it('rethrows a transaction failure when no committed batch can be recovered', async () => {
    const failure = new Error('transaction rolled back');
    const prisma = {
      courseImportBatch: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockRejectedValue(failure),
    };

    await expect(
      new CourseService(prisma as unknown as PrismaService).importSchedule(
        'user-1',
        request(),
      ),
    ).rejects.toBe(failure);
  });

  it('scopes import-result lookup by both user and request ID', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      requestId: 'import-20260915-service',
      status: 'applied',
      payloadHash: 'hash',
      targetSemesterId: 'semester-1',
      result: { courseCount: 1, eventCount: 2 },
      createdAt: new Date('2026-09-17T00:00:00Z'),
      updatedAt: new Date('2026-09-17T00:00:01Z'),
    });
    const service = new CourseService({
      courseImportBatch: { findUnique },
    } as unknown as PrismaService);

    await expect(
      service.getScheduleImport('user-2', 'import-20260915-service'),
    ).resolves.toMatchObject({
      requestId: 'import-20260915-service',
      status: 'applied',
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

  it('does not expose an import result that is absent in the current user scope', async () => {
    const service = new CourseService({
      courseImportBatch: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(
      service.getScheduleImport('user-2', 'import-owned-by-another-user'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
