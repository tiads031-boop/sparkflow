import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateCourseTimeSlots,
  loadCourseTimeTemplates,
  saveCourseTimeTemplates,
} from '../src/utils/courseTimeTemplates.ts';

test('generator normalizes 8:00 and applies ordinary breaks', () => {
  assert.deepEqual(generateCourseTimeSlots({
    firstStart: '8:00', lessonMinutes: 45, breakMinutes: 10, sectionCount: 3,
  }), [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' },
    { number: 3, startTime: '09:50', endTime: '10:35' },
  ]);
});

test('generator replaces one ordinary break with a long break', () => {
  assert.deepEqual(generateCourseTimeSlots({
    firstStart: '08:00', lessonMinutes: 45, breakMinutes: 10, sectionCount: 4,
    longBreakAfter: 2, longBreakMinutes: 60,
  }).map(slot => [slot.startTime, slot.endTime]), [
    ['08:00', '08:45'], ['08:55', '09:40'], ['10:40', '11:25'], ['11:35', '12:20'],
  ]);
});

test('generator rejects invalid ranges and cross-day output', () => {
  assert.throws(() => generateCourseTimeSlots({ firstStart: '25:00', lessonMinutes: 45, breakMinutes: 10, sectionCount: 2 }), /开始时间无效/);
  assert.throws(() => generateCourseTimeSlots({ firstStart: '23:30', lessonMinutes: 45, breakMinutes: 10, sectionCount: 2 }), /午夜/);
  assert.throws(() => generateCourseTimeSlots({ firstStart: '08:00', lessonMinutes: 45, breakMinutes: 10, sectionCount: 1, longBreakAfter: 1, longBreakMinutes: 60 }), /不能设置大课间/);
});

test('template storage is school-scoped and tolerates invalid data', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const template = { id: 'one', name: ' 夏季 ', slots: [{ number: 1, startTime: '08:00', endTime: '08:45' }] };
  saveCourseTimeTemplates('school-a', [template], storage);
  assert.deepEqual(loadCourseTimeTemplates('school-a', storage), [{ ...template, name: '夏季' }]);
  assert.deepEqual(loadCourseTimeTemplates('school-b', storage), []);
  values.set('sparkflow.course-time-templates.v1.school-a', '{broken');
  assert.deepEqual(loadCourseTimeTemplates('school-a', storage), []);
});

test('template loading rebuilds normalized slots and drops invalid entries', () => {
  const storage = {
    getItem: () => JSON.stringify([
      { id: 'legacy', name: ' 旧作息 ', slots: [{ number: '1', startTime: '8:00', endTime: '8：45' }] },
      { id: 'broken', name: '坏数据', slots: [{ number: 2, startTime: '10:00', endTime: '09:00' }] },
    ]),
  };
  assert.deepEqual(loadCourseTimeTemplates('school-a', storage), [{
    id: 'legacy',
    name: '旧作息',
    slots: [{ number: 1, startTime: '08:00', endTime: '08:45' }],
  }]);
});
