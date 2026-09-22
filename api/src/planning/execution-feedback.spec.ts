import { loadExecutionFeedback } from './execution-feedback';

describe('Planner execution evidence', () => {
  it('uses actual time and only reliable matches for observed late starts', async () => {
    const analytics = {
      getTime: jest
        .fn()
        .mockResolvedValueOnce({
          totalActualSeconds: 6000,
          breakdown: [{ key: 'goal-1', actualSeconds: 3600 }],
        })
        .mockResolvedValueOnce({
          totalActualSeconds: 12000,
          breakdown: [
            { key: '阅读', label: '阅读', actualSeconds: 7200 },
            { key: 'untagged', label: '未标记', actualSeconds: 4800 },
          ],
        }),
      getPlanActual: jest.fn().mockResolvedValue({
        plannedSeconds: 15000,
        unplannedActualSeconds: 3000,
        matches: [
          { confidence: 'exact', startDeltaMinutes: 15 },
          { confidence: 'strong', startDeltaMinutes: 3 },
          { confidence: 'inferred', startDeltaMinutes: 90 },
          { confidence: 'none' },
        ],
      }),
    };
    const now = new Date('2026-09-22T12:00:00.000Z');
    const snapshot = await loadExecutionFeedback(
      analytics as never,
      'owner-1',
      now,
      'Asia/Shanghai',
      'goal-1',
    );

    expect(snapshot).toEqual({
      provenance: 'measured',
      observedAt: now.toISOString(),
      actualMinutesLast7Days: 100,
      actualMinutesLast28Days: 200,
      plannedMinutesLast28Days: 250,
      unplannedMinutesLast28Days: 50,
      reliableLateStartsLast28Days: 1,
      comparableSessionsLast28Days: 2,
      inferredMatchesLast28Days: 1,
      topTagsLast28Days: [{ name: '阅读', minutes: 120 }],
      goalActualMinutesLast7Days: 60,
    });
    expect(analytics.getTime).toHaveBeenCalledWith(
      'owner-1',
      expect.any(String),
      now.toISOString(),
      'Asia/Shanghai',
      'day',
      'goal',
    );
  });
});
