import { PomodoroService } from './pomodoro.service';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'focus-1',
    userId: 'user-1',
    taskId: 'task-1',
    title: null,
    entrySource: 'focus',
    tags: [],
    duration: 25,
    focusMode: 'countdown',
    plannedDurationSeconds: 1500,
    effectiveDurationSeconds: 0,
    pausedDurationSeconds: 0,
    startedAt: new Date('2026-09-20T10:00:00.000Z'),
    endedAt: null,
    lastResumedAt: new Date('2026-09-20T10:00:00.000Z'),
    pausedAt: null,
    status: 'active',
    interruptionCount: 0,
    revision: 1,
    clientRequestId: 'request-1',
    notes: null,
    task: { id: 'task-1', title: '复习民法' },
    calendarEvent: null,
    segments: [
      {
        id: 'segment-1',
        sessionId: 'focus-1',
        startedAt: new Date('2026-09-20T10:00:00.000Z'),
        endedAt: null,
        createdAt: new Date('2026-09-20T10:00:00.000Z'),
      },
    ],
    ...overrides,
  };
}

describe('PomodoroService reliable completion', () => {
  it('creates a completed manual actual-time entry with one effective segment', async () => {
    const created = session({
      id: 'manual-1',
      taskId: null,
      task: null,
      title: '阅读判例',
      entrySource: 'manual',
      tags: ['学习'],
      focusMode: 'countup',
      plannedDurationSeconds: 0,
      status: 'completed',
      startedAt: new Date('2026-09-20T08:00:00.000Z'),
      endedAt: new Date('2026-09-20T08:45:00.000Z'),
      effectiveDurationSeconds: 2700,
      duration: 45,
      segments: [
        {
          id: 'manual-segment',
          sessionId: 'manual-1',
          startedAt: new Date('2026-09-20T08:00:00.000Z'),
          endedAt: new Date('2026-09-20T08:45:00.000Z'),
          createdAt: new Date('2026-09-20T08:45:00.000Z'),
        },
      ],
    });
    const tx = {
      task: { findFirst: jest.fn() },
      tag: { upsert: jest.fn().mockResolvedValue({ id: 'tag-1' }) },
      pomodoroSession: { create: jest.fn().mockResolvedValue(created) },
    };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ settings: {} }) }, $transaction: jest.fn((run) => run(tx)) };

    const result = await new PomodoroService(prisma as never).createManual({
      userId: 'user-1',
      title: '阅读判例',
      startedAt: '2026-09-20T08:00:00.000Z',
      endedAt: '2026-09-20T08:45:00.000Z',
      tags: ['#学习', '学习'],
      clientRequestId: 'manual-request',
    });

    expect(tx.pomodoroSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entrySource: 'manual',
          countsTowardActual: true,
          effectiveDurationSeconds: 2700,
          tags: ['学习'],
          status: 'completed',
          segments: {
            create: expect.objectContaining({
              endedAt: new Date('2026-09-20T08:45:00.000Z'),
            }),
          },
        }),
      }),
    );
    expect(result.effectiveDurationSeconds).toBe(2700);
  });

  it('rejects manual backfill when disabled', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ settings: { timeTracking: { manualBackfillEnabled: false } } }) }, $transaction: jest.fn() };
    await expect(new PomodoroService(prisma as never).createManual({
      userId: 'user-1', startedAt: '2026-09-20T08:00:00.000Z', endedAt: '2026-09-20T08:30:00.000Z',
    })).rejects.toThrow('手工补记已关闭');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns actual timeline entries from sessions rather than calendar projections', async () => {
    const prisma = {
      pomodoroSession: {
        findMany: jest.fn().mockResolvedValue([
          session({
            status: 'completed',
            endedAt: new Date('2026-09-20T10:18:00.000Z'),
            effectiveDurationSeconds: 1080,
            tags: [],
            task: { id: 'task-1', title: '复习民法', tags: ['法学'] },
          }),
        ]),
      },
    };

    const result = await new PomodoroService(prisma as never).findTimeline(
      'user-1',
      '2026-09-20T00:00:00.000Z',
      '2026-09-21T00:00:00.000Z',
    );

    expect(prisma.pomodoroSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          countsTowardActual: true,
          effectiveDurationSeconds: { gt: 0 },
        }),
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        title: '复习民法',
        source: 'focus',
        tags: ['法学'],
        effectiveDurationSeconds: 1080,
      }),
    );
  });

  it('updates a manual entry with revision CAS and replaces its effective segment', async () => {
    const current = session({
      id: 'manual-1',
      taskId: null,
      task: null,
      title: '阅读',
      entrySource: 'manual',
      status: 'completed',
      focusMode: 'countup',
      plannedDurationSeconds: 0,
      effectiveDurationSeconds: 1800,
      startedAt: new Date('2026-09-20T08:00:00.000Z'),
      endedAt: new Date('2026-09-20T08:30:00.000Z'),
      lastResumedAt: null,
      revision: 4,
      segments: [{
        id: 'segment-manual', sessionId: 'manual-1',
        startedAt: new Date('2026-09-20T08:00:00.000Z'),
        endedAt: new Date('2026-09-20T08:30:00.000Z'),
        createdAt: new Date('2026-09-20T08:30:00.000Z'),
      }],
    });
    const updated = session({
      ...current,
      revision: 5,
      title: '阅读判例',
      effectiveDurationSeconds: 2700,
      endedAt: new Date('2026-09-20T08:45:00.000Z'),
      segments: [{
        id: 'segment-updated', sessionId: 'manual-1',
        startedAt: new Date('2026-09-20T08:00:00.000Z'),
        endedAt: new Date('2026-09-20T08:45:00.000Z'),
        createdAt: new Date('2026-09-20T08:45:00.000Z'),
      }],
    });
    const tx = {
      task: { findFirst: jest.fn() },
      tag: { upsert: jest.fn().mockResolvedValue({ id: 'tag-1' }) },
      pomodoroSession: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updated),
      },
      pomodoroSegment: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'segment-updated' }),
      },
    };
    const prisma = { $transaction: jest.fn((run) => run(tx)) };

    const result = await new PomodoroService(prisma as never).updateManual('manual-1', 'user-1', {
      expectedRevision: 4,
      title: '阅读判例',
      startedAt: '2026-09-20T08:00:00.000Z',
      endedAt: '2026-09-20T08:45:00.000Z',
      tags: ['学习'],
    });

    expect(tx.pomodoroSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'manual-1', userId: 'user-1', revision: 4, entrySource: 'manual' }),
      data: expect.objectContaining({ effectiveDurationSeconds: 2700, revision: { increment: 1 } }),
    }));
    expect(tx.pomodoroSegment.deleteMany).toHaveBeenCalledWith({ where: { sessionId: 'manual-1' } });
    expect(result.revision).toBe(5);
  });

  it('does not allow focus sessions to be edited through the manual endpoint', async () => {
    const tx = { pomodoroSession: { findFirst: jest.fn().mockResolvedValue(session()) } };
    const prisma = { $transaction: jest.fn((run) => run(tx)) };

    await expect(new PomodoroService(prisma as never).updateManual('focus-1', 'user-1', {
      expectedRevision: 1,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T10:30:00.000Z',
    })).rejects.toThrow('Only manual actual time can be edited');
  });

  it('rejects a stale manual revision before changing segments', async () => {
    const tx = {
      pomodoroSession: {
        findFirst: jest.fn().mockResolvedValue(session({
          id: 'manual-1', entrySource: 'manual', status: 'completed', revision: 3,
        })),
      },
      pomodoroSegment: { deleteMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((run) => run(tx)) };

    await expect(new PomodoroService(prisma as never).updateManual('manual-1', 'user-1', {
      expectedRevision: 2,
      startedAt: '2026-09-20T10:00:00.000Z',
      endedAt: '2026-09-20T10:30:00.000Z',
    })).rejects.toThrow('Actual time changed on another device');
    expect(tx.pomodoroSegment.deleteMany).not.toHaveBeenCalled();
  });

  it('creates a count-up session without an automatic cutoff', async () => {
    const created = session({
      taskId: null,
      task: null,
      focusMode: 'countup',
      plannedDurationSeconds: 0,
    });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ settings: { timeTracking: { focusActualEnabled: false } } }) },
      pomodoroSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(created),
      },
    };

    await new PomodoroService(prisma as never).create({
      userId: 'user-1',
      focusMode: 'countup',
      clientRequestId: 'countup-request',
    });

    expect(prisma.pomodoroSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          focusMode: 'countup',
          plannedDurationSeconds: 0,
          countsTowardActual: false,
        }),
      }),
    );
  });

  it('closes with CAS and writes one internal focus projection', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T10:18:00.000Z'));
    const current = session();
    const completed = session({
      status: 'completed',
      revision: 2,
      endedAt: new Date('2026-09-20T10:18:00.000Z'),
      effectiveDurationSeconds: 1080,
      duration: 18,
      segments: [
        {
          ...current.segments[0],
          endedAt: new Date('2026-09-20T10:18:00.000Z'),
        },
      ],
    });
    const tx = {
      pomodoroSession: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(completed),
      },
      pomodoroSegment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      calendarEvent: { upsert: jest.fn().mockResolvedValue({ id: 'event-1' }) },
    };
    const prisma = { $transaction: jest.fn((run) => run(tx)) };
    const result = await new PomodoroService(prisma as never).complete(
      'focus-1',
      'user-1',
      1,
    );

    expect(tx.pomodoroSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'focus-1',
          revision: 1,
          status: 'active',
        }),
      }),
    );
    expect(tx.calendarEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { focusSessionId: 'focus-1' },
        create: expect.objectContaining({
          eventType: 'focus',
          taskId: null,
          syncStatus: 'skipped',
        }),
      }),
    );
    expect(result.effectiveDurationSeconds).toBe(1080);
    jest.useRealTimers();
  });
});
