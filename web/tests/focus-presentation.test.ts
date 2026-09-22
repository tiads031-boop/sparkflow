import assert from 'node:assert/strict';
import test from 'node:test';
import { focusMinutes, focusRingProgress, formatFocusTime } from '../src/components/focus/focusPresentation.ts';

test('countdown ring uses remaining progress', () => {
  assert.equal(focusRingProgress({ focusMode: 'countdown', duration: 1500, timeLeft: 750 }), 0.5);
});

test('count-up ring cycles over an hour without exceeding one', () => {
  assert.equal(focusRingProgress({ focusMode: 'countup', duration: 0, timeLeft: 1800 }), 0.5);
  assert.equal(focusRingProgress({ focusMode: 'countup', duration: 0, timeLeft: 5400 }), 0.5);
});

test('focus presentation safely formats time and rounded minutes', () => {
  assert.equal(formatFocusTime(1501), '25:01');
  assert.equal(formatFocusTime(-2), '00:00');
  assert.equal(focusMinutes(1499), 25);
});
