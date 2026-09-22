import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('clips a cross-range actual session to its effective segments', async () => {
    const pomodoroSession = {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 'focus-1',
            taskId: null,
            title: '跨日阅读',
            entrySource: 'focus',
            tags: ['阅读', '法学'],
            startedAt: new Date('2026-09-21T23:30:00.000Z'),
            endedAt: new Date('2026-09-22T00:30:00.000Z'),
            effectiveDurationSeconds: 3600,
            segments: [
              {
                startedAt: new Date('2026-09-21T23:30:00.000Z'),
                endedAt: new Date('2026-09-22T00:30:00.000Z'),
              },
            ],
            task: null,
          },
        ])
        .mockResolvedValueOnce([]),
    };
    const prisma = {
      pomodoroSession,
      tag: {
        findMany: jest.fn().mockResolvedValue([
          { name: '阅读', color: '#cae393' },
          { name: '法学', color: '#b0a8db' },
        ]),
      },
    };

    const result = await new AnalyticsService(prisma as never).getTime(
      'user-1',
      '2026-09-22T00:00:00.000Z',
      '2026-09-22T01:00:00.000Z',
      'UTC',
      'day',
      'tag',
    );

    expect(result.totalActualSeconds).toBe(1800);
    expect(pomodoroSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ countsTowardActual: true }),
      }),
    );
    expect(result.buckets).toEqual([
      expect.objectContaining({ key: '2026-09-22', actualSeconds: 1800 }),
    ]);
    expect(
      result.breakdown.reduce((sum, item) => sum + item.actualSeconds, 0),
    ).toBe(1800);
  });
});
