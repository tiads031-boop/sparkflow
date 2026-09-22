import { matchActualToPlanned } from './execution-matching';
import type { ActualFact, PlannedFact } from './analytics.types';

function actual(overrides: Partial<ActualFact> = {}): ActualFact {
  return {
    id: 'actual-1',
    taskId: 'task-1',
    title: '复习民法',
    start: new Date('2026-09-22T08:05:00.000Z'),
    end: new Date('2026-09-22T08:35:00.000Z'),
    effectiveDurationSeconds: 1800,
    source: 'focus',
    tags: ['法学'],
    goal: null,
    ...overrides,
  };
}

function planned(overrides: Partial<PlannedFact> = {}): PlannedFact {
  return {
    id: 'planned-1',
    taskId: 'task-1',
    title: '复习民法',
    start: new Date('2026-09-22T08:00:00.000Z'),
    end: new Date('2026-09-22T08:30:00.000Z'),
    tags: ['法学'],
    goal: null,
    source: 'task',
    ...overrides,
  };
}

describe('analytics execution matching', () => {
  it('prefers an exact task relation', () => {
    expect(matchActualToPlanned(actual(), [planned()])).toEqual(
      expect.objectContaining({
        plannedId: 'planned-1',
        confidence: 'exact',
        relation: 'on_time',
      }),
    );
  });

  it('marks an exact task that starts late', () => {
    expect(
      matchActualToPlanned(
        actual({ start: new Date('2026-09-22T08:18:00.000Z') }),
        [planned()],
      ),
    ).toEqual(
      expect.objectContaining({ relation: 'late', startDeltaMinutes: 18 }),
    );
  });

  it('uses title and overlap for a strong match', () => {
    expect(
      matchActualToPlanned(actual({ taskId: null }), [
        planned({ taskId: null }),
      ]),
    ).toEqual(
      expect.objectContaining({ confidence: 'strong', plannedId: 'planned-1' }),
    );
  });

  it('keeps unrelated actual time unplanned', () => {
    expect(
      matchActualToPlanned(actual({ taskId: null, title: '散步' }), [
        planned({ taskId: null }),
      ]),
    ).toEqual({
      actualId: 'actual-1',
      confidence: 'none',
      relation: 'unplanned',
    });
  });
});
