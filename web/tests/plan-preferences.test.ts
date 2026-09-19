import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlanView, readLastPlanView } from '../src/components/plan/planPreferences.ts';

test('Plan view preference accepts only supported view ids', () => {
  assert.equal(isPlanView('month'), true);
  assert.equal(isPlanView('week'), true);
  assert.equal(isPlanView('agenda'), true);
  assert.equal(isPlanView('timetable'), true);
  assert.equal(isPlanView('timeline'), false);
  assert.equal(isPlanView(null), false);
});

test('Plan view preference falls back to week outside the browser', () => {
  assert.equal(readLastPlanView(), 'week');
});
