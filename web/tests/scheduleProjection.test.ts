import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEvent, Task } from '../src/types/index.ts';
import { computeFreeSlots } from '../src/utils/freeSlots.ts';
import { projectScheduleItems } from '../src/utils/scheduleProjection.ts';

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1', title: '写论文', status: 'To do', priority: 'Medium', colorType: 'green',
  comments: 0, subtasks: [], scheduledStart: '2026-09-12T09:00:00.000Z', estimatedMinutes: 90,
  ...overrides,
});

test('projection derives a missing end from estimatedMinutes', () => {
  const [item] = projectScheduleItems([task()], []);
  assert.equal(item.end, '2026-09-12T10:30:00.000Z');
  assert.equal(item.durationMinutes, 90);
});

test('linked calendar event does not duplicate a scheduled task', () => {
  const event: CalendarEvent = {
    id: 'event-1', taskId: 'task-1', title: '写论文',
    startTime: '2026-09-12T09:00:00.000Z', endTime: '2026-09-12T10:30:00.000Z',
  };
  assert.equal(projectScheduleItems([task()], [event]).length, 1);
});

test('course and external calendar items are locked by source', () => {
  const events: CalendarEvent[] = [
    { id: 'course', courseId: 'c1', title: '高数', startTime: '2026-09-12T08:00:00.000Z', endTime: '2026-09-12T09:00:00.000Z' },
    { id: 'google', externalSource: 'google', title: '会议', startTime: '2026-09-12T10:00:00.000Z', endTime: '2026-09-12T11:00:00.000Z' },
  ];
  assert.deepEqual(projectScheduleItems([], events).map((item) => item.locked), [true, true]);
});

test('free slots merge overlaps and clip to availability', () => {
  const slots = computeFreeSlots([
    { start: '2026-09-12T08:30:00.000Z', end: '2026-09-12T10:00:00.000Z' },
    { start: '2026-09-12T09:30:00.000Z', end: '2026-09-12T11:00:00.000Z' },
  ], new Date('2026-09-12T08:00:00.000Z'), new Date('2026-09-12T12:00:00.000Z'), 30);
  assert.deepEqual(slots.map((slot) => slot.durationMinutes), [30, 60]);
});
