import assert from 'node:assert/strict';
import test from 'node:test';
import type { Course, Semester } from '../src/types/index.ts';
import {
  getCourseDisplayState,
  getCourseTermState,
  shouldShowCoursePrimaryActions,
} from '../src/utils/courseDisplayState.ts';

const semester: Semester = {
  id: 'semester',
  userId: 'user',
  name: '大三上',
  startDate: '2026-09-07',
  endDate: '2027-01-17',
  isActive: true,
  weeks: 19,
  createdAt: '',
  updatedAt: '',
};

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: 'course',
    userId: 'user',
    semesterId: semester.id,
    name: '法律职业伦理',
    color: '#cae393',
    dayOfWeek: 2,
    startTime: '08:00',
    endTime: '08:45',
    weeks: [2],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const thursdayAfternoon = new Date(2026, 8, 17, 15, 3);

test('does not mark a future-week course as already attended', () => {
  const futureCourse = course({ weeks: [11] });
  const termState = getCourseTermState(futureCourse, [semester], thursdayAfternoon);
  assert.equal(termState.currentWeek, 2);
  assert.equal(termState.isScheduledThisWeek, false);
  assert.equal(getCourseDisplayState(futureCourse, 0, termState, thursdayAfternoon).isPastThisWeek, false);
});

test('prefers real event dates when schedule occurrences are available', () => {
  const currentCourse = course();
  const termState = getCourseTermState(currentCourse, [semester], thursdayAfternoon);
  const futureEvents = [{ startTime: '2026-11-17T08:00:00', endTime: '2026-11-17T08:45:00' }];
  assert.equal(
    getCourseDisplayState(currentCourse, 0, termState, thursdayAfternoon, futureEvents).isPastThisWeek,
    false,
  );

  const completedEvents = [{ startTime: '2026-09-15T08:00:00', endTime: '2026-09-15T08:45:00' }];
  assert.equal(
    getCourseDisplayState(currentCourse, 0, termState, thursdayAfternoon, completedEvents).isPastThisWeek,
    true,
  );
});

test('marks a course only after its actual class in the current week has ended', () => {
  const currentCourse = course();
  const termState = getCourseTermState(currentCourse, [semester], thursdayAfternoon);
  assert.equal(termState.isScheduledThisWeek, true);
  assert.equal(getCourseDisplayState(currentCourse, 0, termState, thursdayAfternoon).isPastThisWeek, true);

  const beforeClassEnds = new Date(2026, 8, 15, 8, 30);
  const beforeState = getCourseTermState(currentCourse, [semester], beforeClassEnds);
  assert.equal(getCourseDisplayState(currentCourse, 0, beforeState, beforeClassEnds).isPastThisWeek, false);
});

test('uses the Monday containing the semester start as week one', () => {
  const midweekSemester = { ...semester, startDate: '2026-09-09' };
  const state = getCourseTermState(course(), [midweekSemester], thursdayAfternoon);
  assert.equal(state.currentWeek, 2);
});

test('does not count an occurrence clipped by a midweek semester start', () => {
  const midweekSemester = { ...semester, startDate: '2026-09-09' };
  const firstThursday = new Date(2026, 8, 10, 15, 3);
  const state = getCourseTermState(course({ weeks: [1] }), [midweekSemester], firstThursday);
  assert.equal(state.isScheduledThisWeek, false);
  assert.equal(getCourseDisplayState(course({ weeks: [1] }), 0, state, firstThursday).isPastThisWeek, false);
});

test('recognizes China calendar dates serialized with an ISO offset', () => {
  const serializedSemester = { ...semester, startDate: '2026-09-06T16:00:00.000Z' };
  const state = getCourseTermState(course(), [serializedSemester], thursdayAfternoon);
  assert.equal(state.currentWeek, 2);
  assert.equal(state.isScheduledThisWeek, true);
});

test('hides creation and import cards inside a populated semester', () => {
  assert.equal(shouldShowCoursePrimaryActions('semester', 8), false);
  assert.equal(shouldShowCoursePrimaryActions('semester', 0), true);
  assert.equal(shouldShowCoursePrimaryActions(null, 8), true);
});
