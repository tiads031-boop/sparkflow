import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCourseTime, parseTimeSlots, schoolBackup } from '../src/utils/schoolImport.ts';

test('normalizeCourseTime accepts common timetable variants', () => {
  assert.equal(normalizeCourseTime('8:00'), '08:00');
  assert.equal(normalizeCourseTime(' 08：05 '), '08:05');
  assert.equal(normalizeCourseTime('9﹕30'), '09:30');
  assert.equal(normalizeCourseTime('24:00'), null);
  assert.equal(normalizeCourseTime('08:60'), null);
  assert.equal(normalizeCourseTime('8.00'), null);
});

test('parseTimeSlots normalizes common range connectors', () => {
  assert.deepEqual(parseTimeSlots('1 8：00—8：45\n2 08:55至09:40\n3 10:00～10:45'), [
    { number: 1, start: '08:00', end: '08:45' },
    { number: 2, start: '08:55', end: '09:40' },
    { number: 3, start: '10:00', end: '10:45' },
  ]);
});

test('parseTimeSlots rejects duplicates and reversed ranges', () => {
  assert.throws(() => parseTimeSlots('1 08:00-08:45\n1 09:00-09:45'), /不能重复/);
  assert.throws(() => parseTimeSlots('1 09:00-08:45'), /节次格式/);
});

test('schoolBackup emits normalized course and event times', () => {
  const backup = schoolBackup({
    courses: [
      { name: '数学', day: 1, weeks: [1], startSection: 1, endSection: 2 },
      { name: '英语', day: 2, weeks: [1], isCustomTime: true, customStartTime: '13：30', customEndTime: '15：00' },
    ],
  }, '秋季学期', '2026-09-07', '2026-09-20', '1 8:00—8:45\n2 8:55—9:40');

  assert.equal(backup.courses[0].startTime, '08:00');
  assert.equal(backup.courses[0].endTime, '09:40');
  assert.equal(backup.courses[1].startTime, '13:30');
  assert.equal(backup.courses[1].endTime, '15:00');
  assert.match(backup.courses[0].events[0].startTime, /T00:00:00\.000Z$/);
});
