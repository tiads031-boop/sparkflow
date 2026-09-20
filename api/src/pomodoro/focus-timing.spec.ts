import { calculateFocusTiming, focusCompletionTime } from './focus-timing';

describe('reliable focus timing', () => {
  it('counts only active segments and excludes pauses', () => {
    const timing = calculateFocusTiming({
      startedAt: new Date('2026-09-20T23:50:00Z'),
      endedAt: new Date('2026-09-21T00:13:00Z'),
      status: 'completed',
      plannedDurationSeconds: 25 * 60,
      segments: [
        {
          startedAt: new Date('2026-09-20T23:50:00Z'),
          endedAt: new Date('2026-09-21T00:00:00Z'),
        },
        {
          startedAt: new Date('2026-09-21T00:05:00Z'),
          endedAt: new Date('2026-09-21T00:13:00Z'),
        },
      ],
    });
    expect(timing.effectiveDurationSeconds).toBe(18 * 60);
    expect(timing.pausedDurationSeconds).toBe(5 * 60);
    expect(timing.elapsedDurationSeconds).toBe(23 * 60);
  });

  it('caps a backgrounded active session at its planned cutoff', () => {
    const session = {
      startedAt: new Date('2026-09-20T10:00:00Z'),
      endedAt: null,
      status: 'active',
      plannedDurationSeconds: 25 * 60,
      segments: [
        { startedAt: new Date('2026-09-20T10:00:00Z'), endedAt: null },
      ],
    };
    const completion = focusCompletionTime(
      session,
      new Date('2026-09-21T10:00:00Z'),
    );
    expect(completion.toISOString()).toBe('2026-09-20T10:25:00.000Z');
    expect(
      calculateFocusTiming({ ...session, endedAt: completion }, completion)
        .effectiveDurationSeconds,
    ).toBe(25 * 60);
  });

  it('preserves effective time while paused', () => {
    const timing = calculateFocusTiming(
      {
        startedAt: new Date('2026-09-20T10:00:00Z'),
        endedAt: null,
        status: 'paused',
        plannedDurationSeconds: 25 * 60,
        segments: [
          {
            startedAt: new Date('2026-09-20T10:00:00Z'),
            endedAt: new Date('2026-09-20T10:10:00Z'),
          },
        ],
      },
      new Date('2026-09-20T10:20:00Z'),
    );
    expect(timing.effectiveDurationSeconds).toBe(10 * 60);
    expect(timing.remainingSeconds).toBe(15 * 60);
  });
});
