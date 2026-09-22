import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlanItems, getPlanRange, type PlanItem } from '../src/components/plan/planProjection.ts';
import { ganttDayOffset, proposeGanttAdjustment } from '../src/components/plan/ganttAdjustment.ts';

test('two-week Gantt shares course, task and external-calendar projection', () => {
  const range = getPlanRange(new Date(2026, 8, 23), 'gantt');
  assert.equal(range.start.getDate(), 21);
  assert.equal(range.end.getDate(), 5);
  const items = buildPlanItems({
    tasks: [{ id: 't', title: '任务', status: 'To do', priority: 'Medium', colorType: 'green', comments: 0, subtasks: [], scheduledStart: new Date(2026, 8, 22, 22).toISOString(), scheduledEnd: new Date(2026, 8, 23, 2).toISOString() }],
    courses: [{ id: 'c', userId: 'u', name: '课程', dayOfWeek: 1, startTime: '08:00', endTime: '09:00', createdAt: '', updatedAt: '' }],
    calendarEvents: [{ id: 'g', title: 'Google', startTime: new Date(2026, 9, 4, 10).toISOString(), endTime: new Date(2026, 9, 4, 11).toISOString(), externalSource: 'google' }],
    range,
  });
  assert.ok(items.some((item) => item.kind === 'task' && item.taskId === 't'));
  assert.ok(items.some((item) => item.kind === 'course' && item.courseId === 'c'));
  assert.ok(items.some((item) => item.sourceLabel === 'Google 日历'));
});

test('Gantt date shifts preserve wall time across DST and keep external items read-only', () => {
  const item: PlanItem = { id: 't', kind: 'task', sourceId: 't', taskId: 't', title: '任务', start: new Date(2026, 2, 7, 9).toISOString(), end: new Date(2026, 2, 7, 10).toISOString(), color: '#aaa', locked: false, completed: false };
  const shifted = proposeGanttAdjustment(item, 2, 'move');
  assert.equal(shifted?.start.getHours(), 9);
  assert.equal(shifted?.end.getHours(), 10);
  assert.equal(shifted?.start.getDate(), 9);
  assert.equal(ganttDayOffset(new Date(2026, 2, 9), new Date(2026, 2, 7)), 2);
  assert.equal(proposeGanttAdjustment({ ...item, kind: 'calendar' }, 1, 'move'), null);
  assert.equal(proposeGanttAdjustment({ ...item, preview: true }, 1, 'resize'), null);
});
