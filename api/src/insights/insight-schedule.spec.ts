import {
  mergeInsightScheduleSettings,
  normalizeInsightSchedulePatch,
  parseInsightSchedule,
  resolveInsightScheduleWindow,
} from './insight-schedule';

describe('insight schedule', () => {
  it('defaults to disabled weekly Sunday at 20:00 and inherits notification timezone', () => {
    expect(parseInsightSchedule({ notification: { timeZone: 'Asia/Shanghai' } }, new Date('2026-09-20T00:00:00Z'))).toEqual({
      enabled: false,
      cadence: 'weekly',
      weekDay: 0,
      hour: 20,
      minute: 0,
      intervalDays: 7,
      timeZone: 'Asia/Shanghai',
      anchorDate: '2026-09-20',
    });
  });

  it('resolves a stable timezone-aware weekly period key', () => {
    const schedule = {
      enabled: true,
      cadence: 'weekly' as const,
      weekDay: 0,
      hour: 20,
      minute: 0,
      intervalDays: 7,
      timeZone: 'Asia/Shanghai',
      anchorDate: '2026-09-01',
    };
    const result = resolveInsightScheduleWindow(new Date('2026-09-20T12:05:00Z'), schedule);
    expect(result?.runKey).toBe('auto:weekly:2026-09-20');
    expect(result?.periodEnd.toISOString()).toBe('2026-09-20T12:00:00.000Z');
    expect(result?.periodStart.toISOString()).toBe('2026-09-13T12:00:00.000Z');
  });

  it('keeps weekly and interval cadence mutually exclusive', () => {
    const current = parseInsightSchedule({}, new Date('2026-09-20T00:00:00Z'));
    const next = normalizeInsightSchedulePatch(current, {
      enabled: true,
      cadence: 'interval',
      intervalDays: 5,
      timeZone: 'Asia/Tokyo',
    }, new Date('2026-09-20T00:00:00Z'));
    expect(next.cadence).toBe('interval');
    expect(next.intervalDays).toBe(5);
    expect(next.anchorDate).toBe('2026-09-20');
    expect(mergeInsightScheduleSettings({ appearance: 'dark' }, next)).toEqual({
      appearance: 'dark',
      insightSchedule: next,
    });
  });

  it('returns one stable interval window after the configured local time', () => {
    const result = resolveInsightScheduleWindow(new Date('2026-09-20T12:00:00Z'), {
      enabled: true,
      cadence: 'interval',
      weekDay: 0,
      hour: 20,
      minute: 0,
      intervalDays: 5,
      timeZone: 'Asia/Shanghai',
      anchorDate: '2026-09-10',
    });
    expect(result?.runKey).toBe('auto:interval:2026-09-20');
    expect(result?.periodStart.toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });
});
