import assert from 'node:assert/strict';
import test from 'node:test';
import { proposeWeekAdjustment } from '../src/components/plan/weekAdjustment.ts';

test('moving snaps the start and keeps an arbitrary minute duration', () => {
  const start = new Date(2026, 8, 21, 9, 7);
  const end = new Date(2026, 8, 21, 10, 4);
  const result = proposeWeekAdjustment(start, end, start, 31, 1, 'move');
  assert.equal(result?.start.getDate(), 22);
  assert.equal(result?.start.getHours(), 9);
  assert.equal(result?.start.getMinutes(), 45);
  assert.equal((result!.end.getTime() - result!.start.getTime()) / 60_000, 57);
  const nearMidnight = proposeWeekAdjustment(start, end, start, 900, 0, 'move');
  assert.equal(nearMidnight?.start.getHours(), 23);
  assert.equal(nearMidnight?.end.getHours(), 23);
});

test('resizing snaps the end without moving the original start', () => {
  const start = new Date(2026, 8, 21, 9, 7);
  const end = new Date(2026, 8, 21, 10, 4);
  const result = proposeWeekAdjustment(start, end, start, 28, 1, 'resize');
  assert.equal(result?.start.getTime(), start.getTime());
  assert.equal(result?.end.getHours(), 10);
  assert.equal(result?.end.getMinutes(), 30);
  assert.equal((result!.end.getTime() - result!.start.getTime()) / 60_000, 83);
  assert.equal(proposeWeekAdjustment(start, end, start, -100, 0, 'resize'), null);
});
