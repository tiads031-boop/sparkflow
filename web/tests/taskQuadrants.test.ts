import test from 'node:test';
import assert from 'node:assert/strict';
import type { Task } from '../src/types/index.ts';
import { getTaskQuadrant, groupTasksByQuadrant } from '../src/utils/taskQuadrants.ts';

const NOW = new Date('2026-09-17T00:00:00.000Z').getTime();
const task = (overrides: Partial<Task>): Task => ({
  id: 'task', title: '任务', status: 'To do', priority: 'Medium', colorType: 'green', comments: 0, subtasks: [], ...overrides,
});

test('maps priority and a 72-hour deadline to the four quadrants', () => {
  assert.equal(getTaskQuadrant(task({ priority: 'High Priority', dueDate: '2026-09-18T00:00:00.000Z' }), NOW), 'important-urgent');
  assert.equal(getTaskQuadrant(task({ priority: 'High Priority', dueDate: '2026-10-01T00:00:00.000Z' }), NOW), 'important-later');
  assert.equal(getTaskQuadrant(task({ dueDate: '2026-09-19T00:00:00.000Z' }), NOW), 'urgent');
  assert.equal(getTaskQuadrant(task({}), NOW), 'later');
});

test('excludes completed and cancelled tasks from quadrant groups', () => {
  const groups = groupTasksByQuadrant([
    task({ id: 'open' }),
    task({ id: 'done', status: 'Done' }),
    task({ id: 'cancelled', status: 'Cancelled' }),
  ], NOW);
  assert.deepEqual(groups.later.map((item) => item.id), ['open']);
});
