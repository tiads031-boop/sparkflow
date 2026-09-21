import assert from 'node:assert/strict';
import test from 'node:test';
import type { ActualTimelineEntry } from '../src/api/actualTimeline.ts';
import { findActualTimelineGaps, matchActualToPlan } from '../src/components/plan/executionMatching.ts';
import type { PlanItem } from '../src/components/plan/planProjection.ts';

function actual(overrides: Partial<ActualTimelineEntry> = {}): ActualTimelineEntry {
  return {
    id: 'actual-1', taskId: 'task-1', title: '复习民法', start: '2026-09-21T10:03:00.000Z', end: '2026-09-21T10:58:00.000Z', effectiveDurationSeconds: 55 * 60, pausedDurationSeconds: 0, source: 'focus', status: 'completed', notes: null, tags: [], revision: 1, ...overrides,
  };
}

function planned(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: 'plan-1', kind: 'task', sourceId: 'task-1', taskId: 'task-1', title: '复习民法', start: '2026-09-21T10:00:00.000Z', end: '2026-09-21T11:00:00.000Z', color: '#8fc7bb', locked: false, completed: false, ...overrides,
  };
}

test('execution matching prefers exact task relation and applies shared tolerances', () => {
  const match = matchActualToPlan(actual(), [planned()]);
  assert.equal(match.confidence, 'exact');
  assert.equal(match.relation, 'on_time');
  assert.equal(match.label, '与计划一致');
});

test('execution matching marks nearby partial-title matches as inferred', () => {
  const match = matchActualToPlan(actual({ taskId: null, title: '民法复习' }), [planned({ taskId: undefined, title: '民法复习 · 第三章', start: '2026-09-21T10:20:00.000Z' })]);
  assert.equal(match.confidence, 'inferred');
  assert.equal(match.label, '推测匹配');
});

test('actual gaps only include intervals over the central threshold', () => {
  const entries = [
    actual({ id: 'first', start: '2026-09-21T09:00:00.000Z', end: '2026-09-21T10:00:00.000Z' }),
    actual({ id: 'second', start: '2026-09-21T10:15:00.000Z', end: '2026-09-21T10:30:00.000Z' }),
    actual({ id: 'third', start: '2026-09-21T11:00:00.000Z', end: '2026-09-21T11:30:00.000Z' }),
  ];
  assert.deepEqual(findActualTimelineGaps(entries).map((gap) => gap.minutes), [30]);
});
