import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampFocusDuration,
  durationFromPointer,
  durationToDegrees,
} from '../src/components/focus/focusDuration.ts';

test('exact focus duration clamps to the supported 5-180 minute range', () => {
  assert.equal(clampFocusDuration(1), 5);
  assert.equal(clampFocusDuration(37), 37);
  assert.equal(clampFocusDuration(240), 180);
});

test('dial maps the top and right points to snapped durations', () => {
  assert.equal(durationFromPointer(50, 0, 50, 50), 5);
  assert.equal(durationFromPointer(100, 50, 50, 50), 50);
});

test('dial angle reflects an exact duration', () => {
  assert.equal(durationToDegrees(5), 0);
  assert.equal(durationToDegrees(180), 360);
});
