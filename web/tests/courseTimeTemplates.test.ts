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

test('JISU adapters expose import-ready summer and winter built-in templates', () => {
  const storage = { getItem: () => null };
  const templates = loadCourseTimeTemplates('jisu_external', storage);
  assert.deepEqual(templates.map(template => [template.name, template.builtIn, template.slots.length]), [
    ['吉林外国语大学 · 夏季作息', true, 12],
    ['吉林外国语大学 · 冬季作息', true, 12],
  ]);
  assert.deepEqual(templates[0]?.slots.slice(2, 8), [
    { number: 3, startTime: '10:00', endTime: '10:45' },
    { number: 4, startTime: '10:55', endTime: '11:40' },
    { number: 5, startTime: '13:30', endTime: '14:15' },
    { number: 6, startTime: '14:25', endTime: '15:10' },
    { number: 7, startTime: '15:20', endTime: '16:05' },
    { number: 8, startTime: '16:10', endTime: '16:55' },
  ]);
  assert.deepEqual(templates[1]?.slots.slice(2, 8), [
    { number: 3, startTime: '10:10', endTime: '10:55' },
    { number: 4, startTime: '11:05', endTime: '11:50' },
    { number: 5, startTime: '13:10', endTime: '13:55' },
    { number: 6, startTime: '14:00', endTime: '14:45' },
    { number: 7, startTime: '14:55', endTime: '15:40' },
    { number: 8, startTime: '15:45', endTime: '16:30' },
  ]);
  assert.equal(loadCourseTimeTemplates('jisu_campus', storage).length, 2);
});

test('built-in templates are not copied into user storage', () => {
  let serialized = '';
  const storage = {
    getItem: () => null,
    setItem: (_key: string, value: string) => { serialized = value; },
  };
  const templates = loadCourseTimeTemplates('jisu_external', storage);
  saveCourseTimeTemplates('jisu_external', [
    ...templates,
    { id: 'custom', name: '我的作息', slots: [{ number: 1, startTime: '08:10', endTime: '08:55' }] },
  ], storage);
  assert.deepEqual(JSON.parse(serialized), [
    { id: 'custom', name: '我的作息', slots: [{ number: 1, startTime: '08:10', endTime: '08:55' }] },
  ]);
});
