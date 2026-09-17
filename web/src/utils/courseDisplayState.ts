import type { CalendarEvent, Course, Semester } from '../types';

type SemesterTiming = Pick<Semester, 'id' | 'startDate' | 'endDate' | 'weeks'>;

export interface CourseTermState {
  isEnded: boolean;
  currentWeek: number | null;
  isScheduledThisWeek: boolean;
}

export interface CourseDisplayState {
  isPastThisWeek: boolean;
  isEnded: boolean;
  group: number;
  order: number;
}

function parseTimeMinutes(time?: string): number {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Semester dates are school calendar dates in China, even when serialized as UTC ISO strings. */
function parseSchoolDate(value?: string): Date | null {
  if (!value) return null;
  const calendarDate = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendarDate) {
    return new Date(Number(calendarDate[1]), Number(calendarDate[2]) - 1, Number(calendarDate[3]));
  }

  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const chinaTime = new Date(instant.getTime() + 8 * 60 * 60 * 1000);
  return new Date(chinaTime.getUTCFullYear(), chinaTime.getUTCMonth(), chinaTime.getUTCDate());
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function mondayOf(date: Date): Date {
  const monday = startOfDay(date);
  monday.setDate(monday.getDate() - ((monday.getDay() || 7) - 1));
  return monday;
}

export function getCourseTermState(
  course: Course,
  semesters: SemesterTiming[],
  now = new Date(),
): CourseTermState {
  const semester = course.semesterId ? semesters.find((item) => item.id === course.semesterId) : null;
  if (!semester) return { isEnded: false, currentWeek: null, isScheduledThisWeek: false };

  const today = startOfDay(now);
  const semesterStart = parseSchoolDate(semester.startDate);
  const semesterEnd = parseSchoolDate(semester.endDate);
  const isAfterEndDate = semesterEnd ? semesterEnd < today : false;

  let currentWeek: number | null = null;
  let isAfterCourseWeeks = false;
  let scheduledDate: Date | null = null;
  if (semesterStart) {
    const firstMonday = mondayOf(semesterStart);
    currentWeek = Math.floor((today.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    if (currentWeek > 0) {
      if (course.weeks?.length) {
        isAfterCourseWeeks = Math.max(...course.weeks) < currentWeek;
      } else if (semester.weeks) {
        isAfterCourseWeeks = semester.weeks < currentWeek;
      }
      if (course.dayOfWeek) {
        scheduledDate = new Date(firstMonday);
        scheduledDate.setDate(scheduledDate.getDate() + (currentWeek - 1) * 7 + course.dayOfWeek - 1);
      }
    }
  }

  const isEnded = isAfterEndDate || isAfterCourseWeeks;
  const isWithinSemesterDates = scheduledDate !== null
    && (!semesterStart || scheduledDate >= semesterStart)
    && (!semesterEnd || scheduledDate <= semesterEnd);
  const isScheduledThisWeek = !isEnded
    && currentWeek !== null
    && currentWeek > 0
    && Boolean(course.weeks?.includes(currentWeek))
    && isWithinSemesterDates;

  return { isEnded, currentWeek, isScheduledThisWeek };
}

export function shouldShowCoursePrimaryActions(activeSemesterId: string | null, courseCount: number): boolean {
  return !activeSemesterId || courseCount === 0;
}

export function getCourseDisplayState(
  course: Course,
  index: number,
  termState: CourseTermState,
  now = new Date(),
  events?: Pick<CalendarEvent, 'startTime' | 'endTime'>[],
): CourseDisplayState {
  const validEvents = events?.filter((event) => {
    const start = Date.parse(event.startTime);
    const end = Date.parse(event.endTime);
    return Number.isFinite(start) && Number.isFinite(end) && end > start;
  });
  const hasFutureEvent = validEvents?.some((event) => Date.parse(event.endTime) > now.getTime()) ?? false;
  const isEnded = termState.isEnded && !hasFutureEvent;

  if (!course.dayOfWeek) {
    return {
      isPastThisWeek: false,
      isEnded,
      group: isEnded ? 3 : 1,
      order: index,
    };
  }

  const currentDay = now.getDay() || 7;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = course.endTime ? parseTimeMinutes(course.endTime) : 24 * 60 - 1;
  const startMinutes = parseTimeMinutes(course.startTime);
  const scheduledTimeHasPassed = course.dayOfWeek < currentDay
    || (course.dayOfWeek === currentDay && endMinutes <= currentMinutes);
  const currentMonday = mondayOf(now);
  const nextMonday = new Date(currentMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const completedEventThisWeek = validEvents?.some((event) => {
    const start = Date.parse(event.startTime);
    return start >= currentMonday.getTime()
      && start < nextMonday.getTime()
      && Date.parse(event.endTime) <= now.getTime();
  });
  const isPastThisWeek = validEvents === undefined
    ? termState.isScheduledThisWeek && scheduledTimeHasPassed
    : Boolean(completedEventThisWeek);

  return {
    isPastThisWeek,
    isEnded,
    group: isEnded ? 3 : (isPastThisWeek ? 2 : 0),
    order: (course.dayOfWeek - currentDay + 7) * 24 * 60 + startMinutes,
  };
}
