import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsRange, analyticsTrend, formatAnalyticsDuration } from '../src/components/analytics/analyticsPresentation.ts';

test('formats analytics duration without demo precision', () => {
  assert.equal(formatAnalyticsDuration(45 * 60), '45 分钟');
  assert.equal(formatAnalyticsDuration(3599), '1 小时');
  assert.equal(formatAnalyticsDuration(2 * 3600 + 20 * 60), '2 小时 20 分');
});

test('compares the current actual period with the previous period', () => {
  assert.deepEqual(analyticsTrend(5400, 3600), { direction: 'up', percent: 50 });
  assert.deepEqual(analyticsTrend(0, 0), { direction: 'flat', percent: 0 });
  assert.deepEqual(analyticsTrend(1800, 0), { direction: 'new', percent: null });
});

test('builds an exclusive range with the selected number of local days', () => {
  const range = analyticsRange(new Date(2026, 8, 22, 6, 0, 0), 'week');
  const milliseconds = new Date(range.end).getTime() - new Date(range.start).getTime();
  assert.equal(milliseconds, 7 * 86_400_000);
  assert.ok(range.timeZone.length > 0);
});
