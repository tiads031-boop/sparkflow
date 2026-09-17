import { PrismaService } from '../src/prisma/prisma.service';
import { CourseService } from '../src/course/course.service';

const USER_ID = 'phase12-postgres-e2e-user';
const SEMESTER_ID = 'phase12-postgres-e2e-semester';
const REQUEST_ID = 'phase12-postgres-e2e-request';

const importRequest = () => ({
  format: 'sparkflow-course-import',
  version: 2,
  requestId: REQUEST_ID,
  targetSemesterId: SEMESTER_ID,
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
        name: 'Phase 12 数据库验收课',
        teacher: 'CI',
        room: 'DB-101',
        dayOfWeek: 1,
        startTime: '08:00',
        endTime: '08:45',
        weeks: [1],
        sourceEntryId: 'phase12-db-course-1',
        events: [
          {
            id: 'source-event-1',
            title: 'Phase 12 数据库验收课',
            startTime: '2026-09-07T00:00:00.000Z',
            endTime: '2026-09-07T00:45:00.000Z',
            location: 'DB-101',
            isOverride: false,
          },
        ],
      },
    ],
  },
});

describe('Phase 12 course import on PostgreSQL', () => {
  const prisma = new PrismaService();
  const service = new CourseService(prisma);

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { id: USER_ID } });
    await prisma.user.create({ data: { id: USER_ID, nickname: 'Phase 12 CI' } });
    await prisma.semester.create({
      data: {
        id: SEMESTER_ID,
        userId: USER_ID,
        name: '2026 秋季',
        startDate: new Date('2026-09-07T00:00:00.000Z'),
        endDate: new Date('2027-01-10T00:00:00.000Z'),
        isActive: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: USER_ID } });
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
        where: { userId: USER_ID, semesterId: SEMESTER_ID },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.calendarEvent.count({
        where: { userId: USER_ID, eventType: 'course' },
      }),
    ).resolves.toBe(1);
  });
});
