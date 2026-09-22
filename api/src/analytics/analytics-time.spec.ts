import { BadRequestException } from '@nestjs/common';
import {
  bucketKey,
  enumerateLocalDays,
  localDateKey,
  parseAnalyticsRange,
} from './analytics-time';

describe('analytics time helpers', () => {
  it('uses the requested time zone at a local-day boundary', () => {
    const value = new Date('2026-09-21T16:30:00.000Z');
    expect(localDateKey(value, 'Asia/Shanghai')).toBe('2026-09-22');
    expect(localDateKey(value, 'UTC')).toBe('2026-09-21');
  });

  it('groups weeks from Monday', () => {
    expect(bucketKey(new Date('2026-09-27T12:00:00.000Z'), 'UTC', 'week')).toBe(
      '2026-09-21',
    );
  });

  it('enumerates zero-value heatmap days across the full range', () => {
    expect(
      enumerateLocalDays(
        new Date('2026-09-20T16:00:00.000Z'),
        new Date('2026-09-23T16:00:00.000Z'),
        'Asia/Shanghai',
      ),
    ).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('rejects invalid and excessive ranges', () => {
    expect(() =>
      parseAnalyticsRange('bad', '2026-09-22T00:00:00.000Z', 'UTC'),
    ).toThrow(BadRequestException);
    expect(() =>
      parseAnalyticsRange(
        '2025-01-01T00:00:00.000Z',
        '2026-09-22T00:00:00.000Z',
        'UTC',
      ),
    ).toThrow(BadRequestException);
  });
});
