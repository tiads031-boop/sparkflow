import { buildSchedule, hasOverlap } from './planner.scheduler';

describe('planner scheduler', () => {
  const start = new Date('2026-09-14T08:00:00.000Z');
  const end = new Date('2026-09-14T12:00:00.000Z');

  it('keeps busy intervals untouched and prioritizes urgent work', () => {
    const result = buildSchedule(
      [
        {
          id: 'low',
          title: 'Low',
          durationMinutes: 60,
          priority: 'low',
          updatedAt: start,
        },
        {
          id: 'high',
          title: 'High',
          durationMinutes: 30,
          priority: 'high',
          updatedAt: start,
        },
      ],
      [
        {
          start: new Date('2026-09-14T08:30:00.000Z'),
          end: new Date('2026-09-14T09:30:00.000Z'),
        },
      ],
      start,
      end,
    );

    expect(result.proposals.map((proposal) => proposal.taskId)).toEqual([
      'high',
      'low',
    ]);
    expect(result.proposals[0].start).toBe('2026-09-14T08:00:00.000Z');
    expect(result.proposals[1].start).toBe('2026-09-14T09:30:00.000Z');
  });

  it('reports tasks that cannot fit before their deadline', () => {
    const result = buildSchedule(
      [
        {
          id: 'late',
          title: 'Late',
          durationMinutes: 90,
          priority: 'medium',
          dueAt: new Date('2026-09-14T09:00:00.000Z'),
          updatedAt: start,
        },
      ],
      [],
      start,
      end,
    );
    expect(result.proposals).toHaveLength(0);
    expect(result.unscheduledTaskIds).toEqual(['late']);
  });

  it('detects overlapping writes', () => {
    expect(
      hasOverlap([
        { start, end: new Date('2026-09-14T09:00:00.000Z') },
        {
          start: new Date('2026-09-14T08:45:00.000Z'),
          end: new Date('2026-09-14T10:00:00.000Z'),
        },
      ]),
    ).toBe(true);
  });
});
