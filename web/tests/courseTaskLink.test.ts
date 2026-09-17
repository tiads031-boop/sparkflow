import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLinkedCourseTask, normalizeLinkedTaskStatus } from '../src/utils/courseTaskLink.ts';

test('linked course tasks use task-list statuses and the study section', () => {
  assert.equal(normalizeLinkedTaskStatus('todo'), 'To do');
  assert.equal(normalizeLinkedTaskStatus('in-progress'), 'In progress');
  assert.equal(normalizeLinkedTaskStatus('done'), 'Done');

  const task = buildLinkedCourseTask({
    id: 'task-1',
    courseId: 'course-1',
    courseName: '法律职业伦理',
    title: '第一次作业',
    status: 'todo',
    tags: ['作业'],
  });
  assert.equal(task.status, 'To do');
  assert.equal(task.section, 'study');
  assert.equal(task.project, '法律职业伦理');
  assert.equal(task.courseId, 'course-1');
  assert.deepEqual(task.tags, ['作业']);
});
