import assert from 'node:assert/strict';
import test from 'node:test';
import {
  goalProgressType,
  progressBarWidth,
  progressHeadline,
} from '../src/lib/goalProgress.ts';
import type { GoalProgressSummary, StudyFolder } from '../src/types/index.ts';

const folder = { progressType: undefined } as StudyFolder;

test('legacy goals default to task progress', () => {
  assert.equal(goalProgressType(folder), 'task');
  assert.equal(goalProgressType({ ...folder, progressType: 'numeric' }), 'numeric');
});

test('progress bars clamp over-target and negative values', () => {
  assert.equal(progressBarWidth(142), 100);
  assert.equal(progressBarWidth(-8), 0);
  assert.equal(progressBarWidth(null), 0);
});

test('progress headline keeps target optional', () => {
  const summary = {
    primary: { current: 21, target: 48, unit: '本' },
  } as GoalProgressSummary;
  assert.equal(progressHeadline(summary), '21 / 48 本');
  assert.equal(
    progressHeadline({ ...summary, primary: { ...summary.primary, target: null } }),
    '21 本',
  );
});
