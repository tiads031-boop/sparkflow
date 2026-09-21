import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTodayMetrics } from '../src/components/today/todayMetrics.ts';
import type { ActualTimelineEntry } from '../src/api/actualTimeline.ts';
import type { PlanItem } from '../src/components/plan/planProjection.ts';
import type { Task } from '../src/types/index.ts';

const baseTask = {
  id: 'task-1', title: '任务', status: 'To do', priority: 'Medium', colorType: 'green', comments: 0, subtasks: [],
} satisfies Task;

test('today metrics only count relevant tasks and actual execution facts', () => {
  const date = new Date('2026-09-22T10:00:00+08:00');
  const tasks: Task[] = [
    { ...baseTask, id: 'scheduled', scheduledStart: '2026-09-22T09:00:00+08:00' },
    { ...baseTask, id: 'done', status: 'Done', completedAt: '2026-09-22T08:00:00+08:00' },
    { ...baseTask, id: 'other', dueDate: '2026-09-23T10:00:00+08:00' },
  ];
  const planned = [{
    id: 'future', kind: 'task', sourceId: 'scheduled', title: '任务', start: '2026-09-22T12:00:00+08:00', end: '2026-09-22T13:00:00+08:00', color: '#fff', locked: false, completed: false,
  }] satisfies PlanItem[];
  const actual = [{
    id: 'actual', taskId: null, title: '阅读', start: '2026-09-22T07:00:00+08:00', end: '2026-09-22T07:30:00+08:00', effectiveDurationSeconds: 1800, pausedDurationSeconds: 0, source: 'manual', status: 'completed', notes: null, tags: [], revision: 1,
  }] satisfies ActualTimelineEntry[];

  assert.deepEqual(calculateTodayMetrics(date, tasks, planned, actual, new Date('2026-09-22T10:00:00+08:00')), {
    actualSeconds: 1800,
    completedTasks: 1,
    relevantTasks: 2,
    pendingItems: 1,
  });
});
