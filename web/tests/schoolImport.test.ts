import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCourseTime,
  parseTimeSlots,
  requiredSectionNumbers,
  schoolBackup,
  serializeTimeSlots,
  summarizeSchoolImport,
} from '../src/utils/schoolImport.ts';

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

test('requiredSectionNumbers returns unique sorted periods and ignores custom-time courses', () => {
  assert.deepEqual(requiredSectionNumbers({
    courses: [
      { name: '数学', day: 1, weeks: [1], startSection: 3, endSection: 5 },
      { name: '英语', day: 2, weeks: [1], startSection: 1, endSection: 3 },
      { name: '实验', day: 3, weeks: [1], startSection: 9, endSection: 10, isCustomTime: true },
    ],
  }), [1, 2, 3, 4, 5]);
});

test('serializeTimeSlots normalizes and sorts structured periods', () => {
  assert.equal(serializeTimeSlots([
    { number: 2, startTime: '8：55', endTime: '9：40' },
    { number: 1, startTime: '8:00', endTime: '8:45' },
  ]), '1 08:00-08:45\n2 08:55-09:40');
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

test('schoolBackup reports missing periods and invalid custom times precisely', () => {
  assert.throws(() => schoolBackup({
    courses: [{ name: '数学', day: 1, weeks: [1], startSection: 1, endSection: 3 }],
  }, '秋季学期', '2026-09-07', '2026-09-20', '1 08:00-08:45\n3 10:00-10:45'), /“数学”缺少第 2 节作息/);

  assert.throws(() => schoolBackup({
    courses: [{ name: '实验', day: 1, weeks: [1], isCustomTime: true, customStartTime: '14:00', customEndTime: '13:00' }],
  }, '秋季学期', '2026-09-07', '2026-09-20', ''), /“实验”的自定义时间无效/);
});

test('schoolBackup clips events to semester dates and summary reports preview counts', () => {
  const data = {
    courses: [
      { name: '数学', day: 1, weeks: [1, 2, 3], startSection: 1, endSection: 1 },
      { name: '数学', day: 3, weeks: [1, 2], startSection: 1, endSection: 1 },
      { name: '英语', day: 2, weeks: [1], startSection: 1, endSection: 1 },
    ],
  };
  const backup = schoolBackup(data, '秋季学期', '2026-09-07', '2026-09-16', '1 08:00-08:45');

  assert.deepEqual(backup.courses.map(course => course.events.length), [2, 2, 1]);
  assert.deepEqual(summarizeSchoolImport(data, backup), {
    scheduleEntryCount: 3,
    uniqueCourseCount: 2,
    generatedEventCount: 5,
    excludedEventCount: 1,
  });
});

test('schoolBackup rejects impossible dates and an entirely clipped schedule', () => {
  const data = { courses: [{ name: '数学', day: 1, weeks: [1], startSection: 1, endSection: 1 }] };
  assert.throws(() => schoolBackup(data, '秋季学期', '2026-02-30', '2026-03-10', '1 08:00-08:45'), /学期起止日期无效/);
  assert.throws(() => schoolBackup(data, '秋季学期', '2026-09-08', '2026-09-13', '1 08:00-08:45'), /日期范围已排除全部上课时间/);
});
