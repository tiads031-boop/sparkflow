import { parseCourseBackup } from './course-backup';

const fixture = () => ({
  format: 'sparkflow-courses', version: 1,
  semesters: [{ id: 'old', name: '秋季', startDate: '2026-09-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z' }],
  courses: [{ name: '数学', semesterId: 'old', weeks: [1, 3], dayOfWeek: 1, startTime: '08:00', endTime: '09:40',
    events: [{ title: '数学（调课）', startTime: '2026-09-08T00:00:00Z', endTime: '2026-09-08T01:40:00Z', isOverride: true, location: 'B101' }] }],
});
describe('course backup validation', () => {
  it('preserves adjusted instances and strips foreign ownership and sync metadata', () => {
    const input = fixture();
    Object.assign(input.courses[0], { userId: 'another-user', googleEventId: 'external', tasks: [{ title: 'secret' }] });
    const result = parseCourseBackup(input);
    expect(result.courses[0].events[0]).toMatchObject({ isOverride: true, location: 'B101' });
    expect(result.courses[0]).not.toHaveProperty('userId');
    expect(result.courses[0]).not.toHaveProperty('tasks');
    expect(result.courses[0]).not.toHaveProperty('googleEventId');
  });
  it('rejects unsupported versions and missing semester references', () => {
    expect(() => parseCourseBackup({ ...fixture(), version: 2 })).toThrow();
    expect(() => parseCourseBackup({ ...fixture(), semesters: [] })).toThrow();
  });
  it('rejects invalid weeks and reversed event ranges before writing anything', () => {
    const input = fixture(); input.courses[0].weeks = [0, 61];
    expect(() => parseCourseBackup(input)).toThrow();
    const reversed = fixture(); reversed.courses[0].events[0].endTime = '2026-09-07T01:40:00Z';
    expect(() => parseCourseBackup(reversed)).toThrow();
  });
});
