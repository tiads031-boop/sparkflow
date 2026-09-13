import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEvent, Task } from '../src/types/index.ts';
import { computeFreeSlots } from '../src/utils/freeSlots.ts';
import { projectScheduleItems, projectScheduleItemsForRange } from '../src/utils/scheduleProjection.ts';
import { isRepeatInstance, moveItemToLocalMinute, resizeItem, snapMinutes, weekDayIndexAtX } from '../src/components/timeline/timelineUtils.ts';

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

test('legacy dueDate and startTime project through the same ScheduleItem path', () => {
  const [item] = projectScheduleItems([task({ scheduledStart: undefined, dueDate: '2026-09-12T00:00:00.000Z', startTime: '09:15', duration: 45 })], []);
  const start = new Date(item.start);
  assert.equal(start.getHours(), 9);
  assert.equal(start.getMinutes(), 15);
  assert.equal(item.durationMinutes, 90);
});

test('range projection expands weekly tasks without duplicating a linked event', () => {
  const repeating = task({ repeatRule: 'weekly', repeatStartDate: '2026-09-07T00:00:00.000Z' });
  const linked: CalendarEvent = { id: 'linked', taskId: repeating.id, title: repeating.title, startTime: '2026-09-14T09:00:00.000Z', endTime: '2026-09-14T10:30:00.000Z' };
  const items = projectScheduleItemsForRange([repeating], [linked], new Date('2026-09-14T00:00:00.000Z'), new Date('2026-09-15T00:00:00.000Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].sourceType, 'task');
});

test('timeline updates snap to 15 minutes and preserve duration while moving', () => {
  const [item] = projectScheduleItems([task({ estimatedMinutes: 37 })], []);
  assert.equal(snapMinutes(22), 15);
  const moved = moveItemToLocalMinute(item, new Date('2026-09-13T00:00:00'), 9 * 60 + 22);
  assert.equal(new Date(moved.scheduledStart).getMinutes(), 15);
  assert.equal((new Date(moved.scheduledEnd).getTime() - new Date(moved.scheduledStart).getTime()) / 60_000, 37);
  assert.equal(resizeItem(item, 52).estimatedMinutes, 45);
});

test('week pointer position resolves a clamped target day for cross-column moves', () => {
  assert.equal(weekDayIndexAtX(100, 100, 700), 0);
  assert.equal(weekDayIndexAtX(449, 100, 700), 3);
  assert.equal(weekDayIndexAtX(799, 100, 700), 6);
  assert.equal(weekDayIndexAtX(20, 100, 700), 0);
  assert.equal(weekDayIndexAtX(900, 100, 700), 6);
});

test('range projection marks generated repeat occurrences as non-base instances', () => {
  const repeating = task({ repeatRule: 'daily', repeatStartDate: '2026-09-12T00:00:00.000Z' });
  const [instance] = projectScheduleItemsForRange([repeating], [], new Date('2026-09-13T00:00:00.000Z'), new Date('2026-09-14T00:00:00.000Z'));
  assert.equal(isRepeatInstance(instance), true);
  assert.equal(isRepeatInstance(projectScheduleItems([task()], [])[0]), false);
});
