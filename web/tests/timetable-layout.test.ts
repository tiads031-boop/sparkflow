import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutTimetableIntervals } from '../src/components/plan/timetableLayout.ts';

test('places overlapping courses into separate lanes', () => {
  const layouts = layoutTimetableIntervals([
    { id: 'a', first: 0, last: 1 },
    { id: 'b', first: 1, last: 2 },
  ]);

  assert.deepEqual(layouts.map(({ id, lane, laneCount }) => ({ id, lane, laneCount })), [
    { id: 'a', lane: 0, laneCount: 2 },
    { id: 'b', lane: 1, laneCount: 2 },
  ]);
});

test('reuses a lane when courses do not share a period', () => {
  const layouts = layoutTimetableIntervals([
    { id: 'a', first: 0, last: 0 },
    { id: 'b', first: 1, last: 1 },
  ]);

  assert.deepEqual(layouts.map(({ id, lane, laneCount }) => ({ id, lane, laneCount })), [
    { id: 'a', lane: 0, laneCount: 1 },
    { id: 'b', lane: 0, laneCount: 1 },
  ]);
});

test('uses one lane count for a connected collision group', () => {
  const layouts = layoutTimetableIntervals([
    { id: 'a', first: 0, last: 2 },
    { id: 'b', first: 0, last: 0 },
    { id: 'c', first: 1, last: 1 },
  ]);

  assert.equal(layouts.length, 3);
  assert.ok(layouts.every(({ laneCount }) => laneCount === 2));
  assert.deepEqual(layouts.map(({ id, lane }) => ({ id, lane })), [
    { id: 'a', lane: 1 },
    { id: 'b', lane: 0 },
    { id: 'c', lane: 0 },
  ]);
});
