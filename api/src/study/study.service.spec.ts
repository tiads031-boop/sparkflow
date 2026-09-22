import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudyService } from './study.service';

describe('StudyService M1', () => {
  it('creates a user-owned folder with existing course and task links', async () => {
    interface CreateArgs {
      data: {
        userId: string;
        name: string;
        description: string | null;
        icon: string;
        color: string;
        courses: { create: Array<{ courseId: string }> };
        tasks: { create: Array<{ taskId: string }> };
      };
    }
    const create = jest.fn(({ data }: CreateArgs) => ({
      id: 'folder-1',
      ...data,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      courses: data.courses.create.map(({ courseId }) => ({
        course: { id: courseId },
      })),
      tasks: data.tasks.create.map(({ taskId }) => ({
        task: { id: taskId },
      })),
    }));
    const prisma = {
      course: { findMany: jest.fn().mockResolvedValue([{ id: 'course-1' }]) },
      task: { findMany: jest.fn().mockResolvedValue([{ id: 'task-1' }]) },
      studyFolder: { create },
    };
    const service = new StudyService(prisma as never);

    const result = await service.create('user-1', {
      name: ' 考研英语 ',
      courseIds: ['course-1'],
      taskIds: ['task-1'],
    });

    const createArgs = create.mock.calls[0][0];
    expect(createArgs.data.userId).toBe('user-1');
    expect(createArgs.data.name).toBe('考研英语');
    expect(result.courses).toEqual([{ id: 'course-1' }]);
    expect(result.tasks).toEqual([{ id: 'task-1' }]);
  });

  it('rejects links to another user course before creating the folder', async () => {
    const prisma = {
      course: { findMany: jest.fn().mockResolvedValue([]) },
      task: { findMany: jest.fn().mockResolvedValue([]) },
      studyFolder: { create: jest.fn() },
    };
    const service = new StudyService(prisma as never);

    await expect(
      service.create('user-1', {
        name: '越权关联',
        courseIds: ['foreign-course'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.studyFolder.create).not.toHaveBeenCalled();
  });

  it('returns active goal planning status without requiring course UI coupling', async () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    const prisma = {
      studyFolder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'goal-1',
            userId: 'user-1',
            name: '法考',
            description: null,
            icon: 'target',
            color: '#cae393',
            status: 'active',
            createdAt: now,
            updatedAt: now,
            courses: [],
            tasks: [{ task: { id: 'task-1', title: '民法第一轮' } }],
          },
        ]),
      },
      planningThread: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'thread-1',
            userId: 'user-1',
            scopeType: 'goal',
            scopeId: 'goal-1',
            status: 'active',
            revision: 4,
            updatedAt: now,
            _count: { conversations: 5, schedulePlans: 1 },
          },
        ]),
      },
    };
    const service = new StudyService(prisma as never);

    const result = await service.findAll('user-1', 'all');

    expect(result[0].courses).toEqual([]);
    expect(result[0].tasks).toEqual([{ id: 'task-1', title: '民法第一轮' }]);
    expect(result[0].planningThread).toEqual({
      id: 'thread-1',
      revision: 4,
      updatedAt: now,
      conversationCount: 5,
      schedulePlanCount: 1,
    });
  });

  it('does not archive a folder owned by another user', async () => {
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const service = new StudyService(prisma as never);

    await expect(
      service.setStatus('folder-1', 'user-2', 'archived'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.studyFolder.update).not.toHaveBeenCalled();
  });

  it('aggregates task, actual-time, and numeric progress with weekly clipping', async () => {
    const weekStart = '2026-09-14T00:00:00.000Z';
    const weekEnd = '2026-09-21T00:00:00.000Z';
    const entry = {
      id: 'entry-1',
      userId: 'user-1',
      studyFolderId: 'goal-1',
      value: 12,
      occurredAt: new Date('2026-09-18T12:00:00.000Z'),
      source: 'manual',
      note: null,
      createdAt: new Date('2026-09-18T12:00:00.000Z'),
      updatedAt: new Date('2026-09-18T12:00:00.000Z'),
    };
    const aggregateActual = jest.fn().mockResolvedValue({
      _sum: { effectiveDurationSeconds: 7_200 },
    });
    const findActual = jest.fn().mockResolvedValue([
      {
        startedAt: new Date('2026-09-13T23:30:00.000Z'),
        endedAt: new Date('2026-09-14T01:00:00.000Z'),
        effectiveDurationSeconds: 5_400,
        segments: [
          {
            startedAt: new Date('2026-09-13T23:30:00.000Z'),
            endedAt: new Date('2026-09-14T01:00:00.000Z'),
          },
        ],
      },
    ]);
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          progressType: 'time',
          targetValue: 180,
          progressUnit: '分钟',
          tasks: [
            { task: { id: 'task-1', status: 'done' } },
            { task: { id: 'task-2', status: 'todo' } },
            { task: { id: 'task-3', status: 'cancelled' } },
          ],
        }),
      },
      pomodoroSession: { aggregate: aggregateActual, findMany: findActual },
      goalProgressEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { value: 12 } }),
        findMany: jest.fn().mockResolvedValue([entry]),
      },
    };
    const service = new StudyService(prisma as never);

    const result = await service.progress(
      'goal-1',
      'user-1',
      weekStart,
      weekEnd,
    );

    expect(result.primary).toEqual({
      current: 120,
      target: 180,
      unit: '分钟',
      source: 'actual_time',
      percent: 66.7,
    });
    expect(result.task).toEqual({ completed: 1, total: 2, percent: 50 });
    expect(result.actual.weekMinutes).toBe(60);
    expect(result.numeric.current).toBe(12);
    expect(aggregateActual).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        taskId: { in: ['task-1', 'task-2', 'task-3'] },
        countsTowardActual: true,
        status: { in: ['completed', 'interrupted'] },
        effectiveDurationSeconds: { gt: 0 },
      },
      _sum: { effectiveDurationSeconds: true },
    });
    expect(findActual).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        taskId: { in: ['task-1', 'task-2', 'task-3'] },
        countsTowardActual: true,
        status: { in: ['completed', 'interrupted'] },
        effectiveDurationSeconds: { gt: 0 },
        startedAt: { lt: new Date(weekEnd) },
        endedAt: { gt: new Date(weekStart) },
      },
      select: {
        startedAt: true,
        endedAt: true,
        effectiveDurationSeconds: true,
        segments: { select: { startedAt: true, endedAt: true } },
      },
    });
  });

  it('creates a manual progress entry only for the owner active numeric goal', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'entry-1' });
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          status: 'active',
          progressType: 'numeric',
          targetValue: 100,
          progressUnit: '页',
        }),
      },
      goalProgressEntry: { create },
    };
    const service = new StudyService(prisma as never);

    await service.createProgressEntry('goal-1', 'user-1', {
      value: 8,
      occurredAt: '2026-09-20T08:00:00.000Z',
      note: ' 第一章 ',
    });

    expect(prisma.studyFolder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'goal-1', userId: 'user-1', status: 'active' },
      }),
    );
    expect(create).toHaveBeenCalledWith({
      data: {
        value: 8,
        occurredAt: new Date('2026-09-20T08:00:00.000Z'),
        note: '第一章',
        userId: 'user-1',
        studyFolderId: 'goal-1',
        source: 'manual',
      },
    });
  });

  it('rejects manual progress for a non-numeric goal', async () => {
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          status: 'active',
          progressType: 'time',
          targetValue: 120,
          progressUnit: '分钟',
        }),
      },
      goalProgressEntry: { create: jest.fn() },
    };
    const service = new StudyService(prisma as never);

    await expect(
      service.createProgressEntry('goal-1', 'user-1', { value: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.goalProgressEntry.create).not.toHaveBeenCalled();
  });
});
