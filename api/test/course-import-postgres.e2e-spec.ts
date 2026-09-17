import { PrismaService } from '../src/prisma/prisma.service';
import { CourseService } from '../src/course/course.service';

const USER_ID = 'phase12-postgres-e2e-user';
const SEMESTER_ID = 'phase12-postgres-e2e-semester';
const USER_TWO_ID = 'phase12-postgres-e2e-user-2';
const SEMESTER_TWO_ID = 'phase12-postgres-e2e-semester-2';
const REQUEST_ID = 'phase12-postgres-e2e-request';

interface ImportRequestOptions {
  requestId?: string;
  targetSemesterId?: string;
  sourceEntryId?: string;
  title?: string;
}

const importRequest = (options: ImportRequestOptions = {}) => {
  const requestId = options.requestId ?? REQUEST_ID;
  const targetSemesterId = options.targetSemesterId ?? SEMESTER_ID;
  const sourceEntryId = options.sourceEntryId ?? 'phase12-db-course-1';
  const title = options.title ?? 'Phase 12 数据库验收课';

  return {
    format: 'sparkflow-course-import',
    version: 2,
    requestId,
    targetSemesterId,
    duplicatePolicy: 'skip',
    source: {
      system: 'ci-e2e',
      schoolId: 'ci-school',
      adapterId: 'ci-adapter',
      termId: '2026-fall',
    },
    backup: {
      format: 'sparkflow-courses',
      version: 1,
      semesters: [
        {
          id: 'source-semester',
          name: '2026 秋季',
          startDate: '2026-09-07T00:00:00.000Z',
          endDate: '2027-01-10T00:00:00.000Z',
        },
      ],
      courses: [
        {
          name: title,
          teacher: 'CI',
          room: 'DB-101',
          dayOfWeek: 1,
          startTime: '08:00',
          endTime: '08:45',
          weeks: [1],
          sourceEntryId,
          events: [
            {
              id: `${sourceEntryId}-event`,
              title,
              startTime: '2026-09-07T00:00:00.000Z',
              endTime: '2026-09-07T00:45:00.000Z',
              location: 'DB-101',
              isOverride: false,
            },
          ],
        },
      ],
    },
  };
};

describe('Phase 12 course import on PostgreSQL', () => {
  const prisma = new PrismaService();
  const service = new CourseService(prisma);

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [USER_ID, USER_TWO_ID] } } });
    await prisma.user.createMany({
      data: [
        { id: USER_ID, nickname: 'Phase 12 CI' },
        { id: USER_TWO_ID, nickname: 'Phase 12 CI 2' },
      ],
    });
    await prisma.semester.createMany({
      data: [
        {
          id: SEMESTER_ID,
          userId: USER_ID,
          name: '2026 秋季',
          startDate: new Date('2026-09-07T00:00:00.000Z'),
          endDate: new Date('2027-01-10T00:00:00.000Z'),
          isActive: true,
        },
        {
          id: SEMESTER_TWO_ID,
          userId: USER_TWO_ID,
          name: '2026 秋季',
          startDate: new Date('2026-09-07T00:00:00.000Z'),
          endDate: new Date('2027-01-10T00:00:00.000Z'),
          isActive: true,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [USER_ID, USER_TWO_ID] } } });
    await prisma.$disconnect();
  });

  it('commits once and replays the same request without duplicating rows', async () => {
    const first = await service.importSchedule(USER_ID, importRequest());
    const second = await service.importSchedule(USER_ID, importRequest());

    expect(first).toMatchObject({
      requestId: REQUEST_ID,
      targetSemesterId: SEMESTER_ID,
      courseCount: 1,
      eventCount: 1,
      skippedCount: 0,
      replayed: false,
    });
    expect(second).toMatchObject({
      requestId: REQUEST_ID,
      targetSemesterId: SEMESTER_ID,
      courseCount: 1,
      eventCount: 1,
      replayed: true,
    });

    await expect(
      prisma.courseImportBatch.count({
        where: { userId: USER_ID, requestId: REQUEST_ID },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.course.count({
        where: { userId: USER_ID, sourceEntryId: 'phase12-db-course-1' },
      }),
    ).resolves.toBe(1);
  });

  it('settles two concurrent copies of the same request as one commit plus one replay', async () => {
    const request = importRequest({
      requestId: 'phase12-postgres-e2e-concurrent',
      sourceEntryId: 'phase12-db-course-concurrent',
      title: 'Phase 12 并发验收课',
    });

    const results = await Promise.all([
      service.importSchedule(USER_ID, request),
      service.importSchedule(USER_ID, request),
    ]);

    expect(results.map(result => result.replayed).sort()).toEqual([false, true]);
    await expect(
      prisma.courseImportBatch.count({
        where: { userId: USER_ID, requestId: request.requestId },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.course.count({
        where: { userId: USER_ID, sourceEntryId: 'phase12-db-course-concurrent' },
      }),
    ).resolves.toBe(1);

    const course = await prisma.course.findFirstOrThrow({
      where: { userId: USER_ID, sourceEntryId: 'phase12-db-course-concurrent' },
      select: { id: true },
    });
    await expect(
      prisma.calendarEvent.count({ where: { userId: USER_ID, courseId: course.id } }),
    ).resolves.toBe(1);
  });

  it('rolls back the import batch when the transaction fails after batch creation', async () => {
    const request = importRequest({
      requestId: 'phase12-postgres-e2e-rollback',
      targetSemesterId: 'phase12-missing-semester',
      sourceEntryId: 'phase12-db-course-rollback',
      title: 'Phase 12 回滚验收课',
    });

    await expect(service.importSchedule(USER_ID, request)).rejects.toThrow('Semester not found');

    await expect(
      prisma.courseImportBatch.count({
        where: { userId: USER_ID, requestId: request.requestId },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.course.count({
        where: { userId: USER_ID, sourceEntryId: 'phase12-db-course-rollback' },
      }),
    ).resolves.toBe(0);
  });

  it('scopes the same request ID independently to each user', async () => {
    const requestId = 'phase12-postgres-e2e-shared-request';
    const firstUserRequest = importRequest({
      requestId,
      targetSemesterId: SEMESTER_ID,
      sourceEntryId: 'phase12-db-course-user-scope',
      title: 'Phase 12 用户隔离课',
    });
    const secondUserRequest = importRequest({
      requestId,
      targetSemesterId: SEMESTER_TWO_ID,
      sourceEntryId: 'phase12-db-course-user-scope',
      title: 'Phase 12 用户隔离课',
    });

    await service.importSchedule(USER_ID, firstUserRequest);
    await service.importSchedule(USER_TWO_ID, secondUserRequest);

    const firstResult = await service.getScheduleImport(USER_ID, requestId);
    const secondResult = await service.getScheduleImport(USER_TWO_ID, requestId);

    expect(firstResult.targetSemesterId).toBe(SEMESTER_ID);
    expect(secondResult.targetSemesterId).toBe(SEMESTER_TWO_ID);
    await expect(
      prisma.courseImportBatch.count({ where: { requestId } }),
    ).resolves.toBe(2);
    await expect(
      prisma.course.count({ where: { userId: USER_ID, sourceEntryId: 'phase12-db-course-user-scope' } }),
    ).resolves.toBe(1);
    await expect(
      prisma.course.count({ where: { userId: USER_TWO_ID, sourceEntryId: 'phase12-db-course-user-scope' } }),
    ).resolves.toBe(1);
  });
});
