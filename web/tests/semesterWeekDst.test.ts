import assert from 'node:assert/strict';
import test from 'node:test';
import { getSemesterWeekNumber } from '../src/components/plan/planProjection.ts';
import type { Semester } from '../src/types/index.ts';

test('academic week advances by calendar dates across spring DST', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/New_York';
    const semester = {
      startDate: '2026-03-01',
      endDate: '2026-06-30',
      weeks: 20,
    } as Semester;
    assert.equal(getSemesterWeekNumber(new Date(2026, 2, 8), semester), 2);
    assert.equal(getSemesterWeekNumber(new Date(2026, 2, 15), semester), 3);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
