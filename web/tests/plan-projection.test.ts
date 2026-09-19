import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEvent, Course, Semester, Task } from '../src/types/index.ts';
import {
  buildPlanItems,
  buildPlannerPreviewItems,
  courseOccursOnDate,
  getPlanRange,
  getSemesterWeekNumber,
  localDateKey,
} from '../src/components/plan/planProjection.ts';

const semester: Semester = {
  id: 'semester-1',
  userId: 'user-1',
  name: '2026 秋季',
  startDate: '2026-09-07',
  endDate: '2027-01-10',
  isActive: true,
  weeks: 18,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

const course: Course = {
  id: 'course-1',
  userId: 'user-1',
  semesterId: semester.id,
  name: '知识产权法',
  color: '#60a5fa',
  dayOfWeek: 1,
  startTime: '08:00',
  endTime: '09:40',
  weeks: [1, 2, 3],
  room: '敏行楼-301',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: '复习民法',
    status: 'To do',
    priority: 'Medium',
    colorType: 'green',
    comments: 0,
    subtasks: [],
    scheduledStart: new Date(2026, 8, 21, 14, 0).toISOString(),
    scheduledEnd: new Date(2026, 8, 21, 15, 0).toISOString(),
    ...overrides,
  };
}

test('semester week and course week rules use local semester dates', () => {
  const thirdMonday = new Date(2026, 8, 21, 12, 0);
  const fourthMonday = new Date(2026, 8, 28, 12, 0);

  assert.equal(getSemesterWeekNumber(thirdMonday, semester), 3);
  assert.equal(courseOccursOnDate(course, thirdMonday, semester), true);
  assert.equal(courseOccursOnDate(course, fourthMonday, semester), false);
});

test('Plan projection deduplicates task-backed and course-backed calendar events', () => {
  const selected = new Date(2026, 8, 21, 12, 0);
  const range = getPlanRange(selected, 'week');
  const calendarEvents: CalendarEvent[] = [
    {
      id: 'task-event',
      title: '复习民法',
      startTime: new Date(2026, 8, 21, 14, 0).toISOString(),
      endTime: new Date(2026, 8, 21, 15, 0).toISOString(),
      eventType: 'task',
      taskId: 'task-1',
    },
    {
      id: 'course-event',
      title: '知识产权法',
      startTime: new Date(2026, 8, 21, 8, 0).toISOString(),
      endTime: new Date(2026, 8, 21, 9, 40).toISOString(),
      eventType: 'course',
      courseId: 'course-1',
      color: '#60a5fa',
    },
    {
      id: 'manual-event',
      title: '社团会议',
      startTime: new Date(2026, 8, 22, 18, 30).toISOString(),
      endTime: new Date(2026, 8, 22, 19, 30).toISOString(),
      eventType: 'manual',
    },
  ];

  const items = buildPlanItems({
    tasks: [task()],
    courses: [course],
    calendarEvents,
    semester,
    range,
  });

  assert.equal(items.filter((item) => item.taskId === 'task-1').length, 1);
  assert.equal(items.filter((item) => item.courseId === 'course-1' && item.kind === 'course').length, 1);
  assert.equal(items.filter((item) => item.kind === 'calendar').length, 1);
});

test('Plan projection creates course fallback occurrences only for active course weeks', () => {
  const thirdWeek = buildPlanItems({
    tasks: [],
    courses: [course],
    calendarEvents: [],
    semester,
    range: getPlanRange(new Date(2026, 8, 21, 12, 0), 'week'),
  });
  assert.equal(thirdWeek.filter((item) => item.kind === 'course').length, 1);
  assert.equal(localDateKey(thirdWeek.find((item) => item.kind === 'course')!.start), '2026-09-21');

  const fourthWeek = buildPlanItems({
    tasks: [],
    courses: [course],
    calendarEvents: [],
    semester,
    range: getPlanRange(new Date(2026, 8, 28, 12, 0), 'week'),
  });
  assert.equal(fourthWeek.filter((item) => item.kind === 'course').length, 0);
});

test('study tasks remain Task facts but project with study context', () => {
  const items = buildPlanItems({
    tasks: [task({ id: 'study-task', section: 'study', courseId: 'course-1' })],
    courses: [],
    calendarEvents: [],
    semester,
    range: getPlanRange(new Date(2026, 8, 21, 12, 0), 'week'),
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].kind, 'study-task');
  assert.equal(items[0].taskId, 'study-task');
});


test('course week filtering does not hide courses when semester context is unavailable', () => {
  assert.equal(courseOccursOnDate(course, new Date(2026, 8, 21, 12, 0), null), true);
});


test('Planner preview projects into temporary AI items without mutating Task schedule facts', () => {
  const original = task({ id: 'preview-task', scheduledStart: undefined, scheduledEnd: undefined, scheduleSource: undefined });
  const previewItems = buildPlannerPreviewItems({
    proposals: [{
      taskId: 'preview-task',
      title: '复习民法',
      start: new Date(2026, 8, 21, 16, 0).toISOString(),
      end: new Date(2026, 8, 21, 17, 0).toISOString(),
      durationMinutes: 60,
      taskUpdatedAt: '2026-09-19T00:00:00.000Z',
      reason: '利用下午空档完成高优先级任务',
    }],
    unscheduledTaskIds: [],
    range: {
      start: new Date(2026, 8, 21, 8, 0).toISOString(),
      end: new Date(2026, 8, 21, 22, 0).toISOString(),
    },
  }, [original]);

  assert.equal(previewItems.length, 1);
  assert.equal(previewItems[0].preview, true);
  assert.equal(previewItems[0].scheduleSource, 'ai');
  assert.equal(previewItems[0].reason, '利用下午空档完成高优先级任务');
  assert.equal(original.scheduledStart, undefined);
});
