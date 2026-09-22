import assert from 'node:assert/strict';
import test from 'node:test';
import type { CalendarEvent, Course, Semester, Task } from '../src/types/index.ts';
import {
  buildPlanItems,
  buildPlannerPreviewItems,
  courseOccursOnDate,
  dedupeCoursesByOccurrence,
  getPlanRange,
  getSemesterWeekNumber,
  itemsForLocalDay,
  clipPlanItemToLocalDay,
  localDateKey,
  mergePlanCourseItems,
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

test('one overnight task and external event appear on both dates across month and week ranges', () => {
  const first = new Date(2026, 8, 30, 23, 30);
  const last = new Date(2026, 9, 1, 0, 30);
  const external: CalendarEvent = {
    id: 'google-overnight', title: '夜间会议', startTime: first.toISOString(),
    endTime: last.toISOString(), eventType: 'google', externalSource: 'google',
    sourceCalendarTitle: 'Work', scheduleLocked: false,
  };
  const source = { tasks: [task({ id: 'overnight', scheduledStart: first.toISOString(), scheduledEnd: last.toISOString() })], courses: [], calendarEvents: [external] };
  const september = buildPlanItems({ ...source, range: getPlanRange(first, 'month') });
  const october = buildPlanItems({ ...source, range: getPlanRange(last, 'month') });
  const week = buildPlanItems({ ...source, range: getPlanRange(first, 'week') });
  for (const items of [september, october, week]) {
    assert.equal(itemsForLocalDay(items, first).length, 2);
    assert.equal(itemsForLocalDay(items, last).length, 2);
    const continuation = itemsForLocalDay(items, last).map((item) => clipPlanItemToLocalDay(item, last));
    assert.ok(continuation.every((item) => new Date(item.start).getTime() === new Date(2026, 9, 1).getTime()));
  }
  const google = september.find((item) => item.sourceId === external.id)!;
  assert.equal(google.sourceLabel, 'Google 日历 · Work');
  assert.equal(google.locked, true);
  assert.equal(itemsForLocalDay(september, new Date(2026, 9, 1, 0, 30)).length, 2);
  const endsAtMidnight = [{ ...google, end: new Date(2026, 9, 1).toISOString() }];
  assert.equal(itemsForLocalDay(endsAtMidnight, last).length, 0);
});

test('planned projection excludes focus compatibility events to avoid actual-time double counting', () => {
  const range = getPlanRange(new Date(2026, 8, 21, 12, 0), 'week');
  const items = buildPlanItems({
    tasks: [task()],
    courses: [],
    calendarEvents: [{
      id: 'focus-event',
      title: '专注 · 复习民法',
      startTime: new Date(2026, 8, 21, 14, 5).toISOString(),
      endTime: new Date(2026, 8, 21, 14, 28).toISOString(),
      eventType: 'focus',
      focusSessionId: 'focus-1',
      focusSession: {
        id: 'focus-1',
        taskId: 'task-1',
        effectiveDurationSeconds: 18 * 60,
        pausedDurationSeconds: 5 * 60,
      },
    }],
    semester: null,
    range,
  });

  assert.equal(items.some((item) => item.kind === 'focus'), false);
  assert.equal(items.filter((item) => item.taskId === 'task-1').length, 1);
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


test('course occurrence filtering rejects courses from another semester', () => {
  const otherSemesterCourse: Course = {
    ...course,
    id: 'course-old-semester',
    semesterId: 'semester-old',
  };

  assert.equal(courseOccursOnDate(otherSemesterCourse, new Date(2026, 8, 21, 12, 0), semester), false);
});


test('duplicate imported course rows collapse into one occurrence and merge weeks', () => {
  const duplicate: Course = {
    ...course,
    id: 'course-duplicate',
    weeks: [3, 5],
    sourceFingerprint: 'duplicate-source',
  };
  const original: Course = {
    ...course,
    weeks: [1, 3],
    sourceFingerprint: 'original-source',
  };

  const deduped = dedupeCoursesByOccurrence([original, duplicate]);

  assert.equal(deduped.length, 1);
  assert.deepEqual(deduped[0].weeks, [1, 3, 5]);
});


test('Plan projection removes visually identical course occurrences from duplicate rows', () => {
  const duplicate: Course = {
    ...course,
    id: 'course-duplicate',
  };

  const items = buildPlanItems({
    tasks: [],
    courses: [course, duplicate],
    calendarEvents: [],
    semester,
    range: getPlanRange(new Date(2026, 8, 21, 12, 0), 'week'),
  });

  assert.equal(items.filter((item) => item.kind === 'course').length, 1);
});


test('Plan projection merges abbreviated course fragments at the same start time', () => {
  const calendarEvents: CalendarEvent[] = [{
    id: 'abbreviated-fragment',
    title: '公证',
    startTime: new Date(2026, 8, 21, 8, 0).toISOString(),
    endTime: new Date(2026, 8, 21, 8, 50).toISOString(),
    eventType: 'course',
    courseId: 'legacy-course-row',
  }];
  const fullCourse: Course = {
    ...course,
    name: '公证法',
  };

  const items = buildPlanItems({
    tasks: [],
    courses: [fullCourse],
    calendarEvents,
    semester,
    range: getPlanRange(new Date(2026, 8, 21, 12, 0), 'week'),
  });
  const courseItems = items.filter((item) => item.kind === 'course');

  assert.equal(courseItems.length, 1);
  assert.equal(courseItems[0].title, '公证法');
  assert.equal(courseItems[0].end, new Date(2026, 8, 21, 9, 40).toISOString());
});

test('adjacent fragments of the same course and room merge into one class block', () => {
  const firstStart = new Date(2026, 8, 22, 8, 0).toISOString();
  const firstEnd = new Date(2026, 8, 22, 8, 45).toISOString();
  const secondStart = new Date(2026, 8, 22, 8, 55).toISOString();
  const secondEnd = new Date(2026, 8, 22, 9, 40).toISOString();
  const merged = mergePlanCourseItems([
    { id: 'part-1', kind: 'course', sourceId: 'part-1', title: '法律职业伦理', start: firstStart, end: firstEnd, color: '#cae393', locked: true, completed: false, location: '中心-305' },
    { id: 'part-2', kind: 'course', sourceId: 'part-2', title: '法律职业伦理', start: secondStart, end: secondEnd, color: '#b0a8db', locked: true, completed: false, location: '中心-305' },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].start, firstStart);
  assert.equal(merged[0].end, secondEnd);
});

test('course fragments in different rooms or with a long gap remain separate', () => {
  const base = { kind: 'course' as const, title: '公证法', color: '#cae393', locked: true, completed: false };
  const differentRoom = mergePlanCourseItems([
    { ...base, id: 'room-a', sourceId: 'room-a', start: new Date(2026, 8, 22, 13, 30).toISOString(), end: new Date(2026, 8, 22, 14, 15).toISOString(), location: '敏行楼-308' },
    { ...base, id: 'room-b', sourceId: 'room-b', start: new Date(2026, 8, 22, 14, 25).toISOString(), end: new Date(2026, 8, 22, 15, 10).toISOString(), location: '敏行楼-309' },
  ]);
  const longGap = mergePlanCourseItems([
    { ...base, id: 'morning', sourceId: 'morning', start: new Date(2026, 8, 22, 8, 0).toISOString(), end: new Date(2026, 8, 22, 8, 45).toISOString(), location: '敏行楼-308' },
    { ...base, id: 'afternoon', sourceId: 'afternoon', start: new Date(2026, 8, 22, 13, 30).toISOString(), end: new Date(2026, 8, 22, 14, 15).toISOString(), location: '敏行楼-308' },
  ]);

  assert.equal(differentRoom.length, 2);
  assert.equal(longGap.length, 2);
});


test('Plan projection keeps genuinely different simultaneous courses separate', () => {
  const otherCourse: Course = {
    ...course,
    id: 'course-2',
    name: '法律文书写作',
  };
  const items = buildPlanItems({
    tasks: [],
    courses: [course, otherCourse],
    calendarEvents: [],
    semester,
    range: getPlanRange(new Date(2026, 8, 21, 12, 0), 'week'),
  });

  assert.equal(items.filter((item) => item.kind === 'course').length, 2);
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
