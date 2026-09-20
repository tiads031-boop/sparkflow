import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutTimetableIntervals, mergeTimetableIntervals } from '../src/components/plan/timetableLayout.ts';

test('merges overlapping and adjacent fragments of the same course', () => {
  const merged = mergeTimetableIntervals([
    { id: 'ethics-1', course: '法律职业伦理', first: 0, last: 0 },
    { id: 'ethics-2', course: '法律职业伦理', first: 0, last: 1 },
    { id: 'notary-1', course: '公证法', first: 4, last: 4 },
    { id: 'notary-2', course: '公证法', first: 5, last: 5 },
  ], (item) => item.course);

  assert.deepEqual(merged.map(({ course, first, last }) => ({ course, first, last })), [
    { course: '法律职业伦理', first: 0, last: 1 },
    { course: '公证法', first: 4, last: 5 },
  ]);
});

test('does not merge different courses that really conflict', () => {
  const merged = mergeTimetableIntervals([
    { id: 'a', course: '法律职业伦理', first: 0, last: 1 },
    { id: 'b', course: '民法分论', first: 0, last: 1 },
  ], (item) => item.course);

  assert.equal(merged.length, 2);
});

test('allows merged course metadata to preserve all active weeks', () => {
  const merged = mergeTimetableIntervals([
    { course: '公证法', first: 4, last: 4, weeks: [1, 3] },
    { course: '公证法', first: 5, last: 5, weeks: [2, 4] },
  ], (item) => item.course, (previous, incoming) => ({
    ...previous,
    first: Math.min(previous.first, incoming.first),
    last: Math.max(previous.last, incoming.last),
    weeks: [...new Set([...previous.weeks, ...incoming.weeks])].sort((a, b) => a - b),
  }));

  assert.deepEqual(merged, [{ course: '公证法', first: 4, last: 5, weeks: [1, 2, 3, 4] }]);
});

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
