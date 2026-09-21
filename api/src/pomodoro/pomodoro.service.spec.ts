import { PomodoroService } from './pomodoro.service';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'focus-1',
    userId: 'user-1',
    taskId: 'task-1',
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
  it('creates a count-up session without an automatic cutoff', async () => {
    const created = session({
      taskId: null,
      task: null,
      focusMode: 'countup',
      plannedDurationSeconds: 0,
    });
    const prisma = {
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
