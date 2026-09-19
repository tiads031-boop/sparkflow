import type { CalendarEvent, Course, PlannerPreview, Semester, Task } from '../../types';

export type PlanItemKind = 'course' | 'calendar' | 'task' | 'study-task';

export interface PlanItem {
  id: string;
  kind: PlanItemKind;
  sourceId: string;
  title: string;
  start: string;
  end: string;
  color: string;
  locked: boolean;
  completed: boolean;
  location?: string;
  taskId?: string;
  courseId?: string;
  scheduleSource?: string;
  preview?: boolean;
  reason?: string;
}

export interface DateRange {
  start: Date;
  end: Date;
}

function dateAtLocalMidnight(value: string | Date): Date {
  if (value instanceof Date) {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function startOfLocalDay(date: Date): Date {
  return dateAtLocalMidnight(date);
}

export function addLocalDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function getMonday(date: Date): Date {
  const result = startOfLocalDay(date);
  const day = result.getDay() || 7;
  result.setDate(result.getDate() - day + 1);
  return result;
}

export function getPlanRange(date: Date, view: 'month' | 'week' | 'agenda' | 'timetable'): DateRange {
  if (view === 'month') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { start, end: new Date(date.getFullYear(), date.getMonth() + 1, 1) };
  }

  if (view === 'agenda') {
    const start = startOfLocalDay(date);
    return { start, end: addLocalDays(start, 1) };
  }

  const start = getMonday(date);
  return { start, end: addLocalDays(start, 7) };
}

export function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSemesterWeekNumber(date: Date, semester?: Semester | null): number | null {
  if (!semester?.startDate) return null;
  const start = dateAtLocalMidnight(semester.startDate);
  const target = startOfLocalDay(date);
  const days = Math.floor((target.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  if (semester.weeks && week > semester.weeks) return null;
  return week;
}

export function courseOccursOnDate(course: Course, date: Date, semester?: Semester | null): boolean {
  const weekday = date.getDay() || 7;
  if (!course.dayOfWeek || course.dayOfWeek !== weekday) return false;

  if (semester) {
    if (course.semesterId && course.semesterId !== semester.id) return false;
    const target = startOfLocalDay(date);
    const semesterStart = dateAtLocalMidnight(semester.startDate);
    const semesterEnd = dateAtLocalMidnight(semester.endDate);
    if (target < semesterStart || target > semesterEnd) return false;
  }

  if (!course.weeks?.length) return true;
  // Without semester boundaries we cannot reliably interpret week numbers.
  // Prefer showing the course instead of incorrectly marking/hiding it.
  if (!semester) return true;
  const week = getSemesterWeekNumber(date, semester);
  return week !== null && course.weeks.includes(week);
}

function normalizeOccurrenceText(value?: string | null): string {
  return (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function courseOccurrenceKey(course: Course): string {
  return [
    course.semesterId || '',
    normalizeOccurrenceText(course.name),
    course.dayOfWeek || '',
    course.startTime || '',
    course.endTime || '',
    normalizeOccurrenceText(course.room || course.location),
  ].join('|');
}

export function dedupeCoursesByOccurrence(courses: Course[]): Course[] {
  const unique = new Map<string, Course>();

  for (const course of courses) {
    const key = courseOccurrenceKey(course);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, course);
      continue;
    }

    const existingWeeks = existing.weeks?.length ? existing.weeks : null;
    const incomingWeeks = course.weeks?.length ? course.weeks : null;
    unique.set(key, {
      ...existing,
      weeks: existingWeeks && incomingWeeks
        ? [...new Set([...existingWeeks, ...incomingWeeks])].sort((a, b) => a - b)
        : undefined,
    });
  }

  return [...unique.values()];
}

function planCourseOccurrenceKey(item: PlanItem): string {
  return [
    normalizeOccurrenceText(item.title),
    new Date(item.start).getTime(),
    new Date(item.end).getTime(),
    normalizeOccurrenceText(item.location),
  ].join('|');
}

function dedupePlanCourseItems(items: PlanItem[]): PlanItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (item.kind !== 'course') return true;
    const key = planCourseOccurrenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function combineLocalDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date);
  result.setHours(hours || 0, minutes || 0, 0, 0);
  return result;
}

function getTaskRange(task: Task): { start: Date; end: Date } | null {
  if (task.status === 'Cancelled' || !task.scheduledStart && !(task.dueDate && task.startTime)) return null;

  const start = task.scheduledStart
    ? new Date(task.scheduledStart)
    : combineLocalDateAndTime(new Date(task.dueDate!), task.startTime!);
  if (Number.isNaN(start.getTime())) return null;

  const duration = task.duration || task.estimatedMinutes || 30;
  const end = task.scheduledEnd ? new Date(task.scheduledEnd) : new Date(start.getTime() + duration * 60_000);
  return { start, end };
}

function intersects(start: Date, end: Date, range: DateRange): boolean {
  return start < range.end && end > range.start;
}

function taskColor(task: Task): string {
  if (task.scheduleColor) return task.scheduleColor;
  if (task.section === 'study' || task.courseId) return '#8f7bd8';
  if (task.colorType === 'dark') return '#242424';
  if (task.colorType === 'purple') return '#a78bfa';
  return '#9fca52';
}

function buildTaskItems(tasks: Task[], range: DateRange): PlanItem[] {
  return tasks.flatMap((task) => {
    const taskRange = getTaskRange(task);
    if (!taskRange || !intersects(taskRange.start, taskRange.end, range)) return [];

    return [{
      id: `task:${task.id}`,
      kind: task.section === 'study' || Boolean(task.courseId) ? 'study-task' : 'task',
      sourceId: task.id,
      title: task.title,
      start: taskRange.start.toISOString(),
      end: taskRange.end.toISOString(),
      color: taskColor(task),
      locked: Boolean(task.scheduleLocked),
      completed: task.status === 'Done',
      taskId: task.id,
      courseId: task.courseId,
      scheduleSource: task.scheduleSource,
    } satisfies PlanItem];
  });
}

function buildCalendarItems(events: CalendarEvent[], range: DateRange): PlanItem[] {
  return events.flatMap((event) => {
    // Cancelled course occurrences are tombstones that suppress the Course fallback.
    if (event.overrideType === 'cancel') return [];
    // A task-backed calendar event represents the same fact as scheduled Task.
    if (event.taskId || event.extendedProps?.taskId) return [];

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || !intersects(start, end, range)) return [];

    const isCourse = event.eventType?.toLowerCase() === 'course' || Boolean(event.courseId);
    return [{
      id: `calendar:${event.id}`,
      kind: isCourse ? 'course' : 'calendar',
      sourceId: event.id,
      title: event.title,
      start: start.toISOString(),
      end: end.toISOString(),
      color: event.color || (isCourse ? '#60a5fa' : '#f4b860'),
      locked: event.scheduleLocked ?? true,
      completed: false,
      location: event.location || undefined,
      courseId: event.courseId,
    } satisfies PlanItem];
  });
}

function buildCourseFallbackItems(
  courses: Course[],
  events: CalendarEvent[],
  semester: Semester | null | undefined,
  range: DateRange,
): PlanItem[] {
  const existingCourseDays = new Set(
    events
      .filter((event) => event.courseId)
      .flatMap((event) => [
        `${event.courseId}:${localDateKey(event.startTime)}`,
        ...(event.overrideOriginalStart
          ? [`${event.courseId}:${localDateKey(event.overrideOriginalStart)}`]
          : []),
      ]),
  );

  const items: PlanItem[] = [];
  const uniqueCourses = dedupeCoursesByOccurrence(courses);
  for (let date = startOfLocalDay(range.start); date < range.end; date = addLocalDays(date, 1)) {
    for (const course of uniqueCourses) {
      if (!course.startTime || !course.endTime || !courseOccursOnDate(course, date, semester)) continue;
      const dedupeKey = `${course.id}:${localDateKey(date)}`;
      if (existingCourseDays.has(dedupeKey)) continue;

      const start = combineLocalDateAndTime(date, course.startTime);
      const end = combineLocalDateAndTime(date, course.endTime);
      items.push({
        id: `course:${course.id}:${localDateKey(date)}`,
        kind: 'course',
        sourceId: course.id,
        title: course.name,
        start: start.toISOString(),
        end: end.toISOString(),
        color: course.color || '#60a5fa',
        locked: true,
        completed: false,
        location: course.room || course.location,
        courseId: course.id,
      });
    }
  }
  return items;
}

export function buildPlanItems(input: {
  tasks: Task[];
  courses: Course[];
  calendarEvents: CalendarEvent[];
  semester?: Semester | null;
  range: DateRange;
}): PlanItem[] {
  const calendarItems = buildCalendarItems(input.calendarEvents, input.range);
  const items = [
    ...buildTaskItems(input.tasks, input.range),
    ...calendarItems,
    ...buildCourseFallbackItems(input.courses, input.calendarEvents, input.semester, input.range),
  ];

  return dedupePlanCourseItems(items)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function buildPlannerPreviewItems(preview: PlannerPreview | null | undefined, tasks: Task[]): PlanItem[] {
  if (!preview?.proposals.length) return [];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  return preview.proposals.flatMap((proposal) => {
    const task = taskMap.get(proposal.taskId);
    const start = new Date(proposal.start);
    const end = new Date(proposal.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

    return [{
      id: `preview:${proposal.taskId}`,
      kind: task?.section === 'study' || Boolean(task?.courseId) ? 'study-task' : 'task',
      sourceId: proposal.taskId,
      title: proposal.title,
      start: start.toISOString(),
      end: end.toISOString(),
      color: task ? taskColor(task) : '#8b7fbc',
      locked: false,
      completed: false,
      taskId: proposal.taskId,
      courseId: task?.courseId,
      scheduleSource: 'ai',
      preview: true,
      reason: proposal.reason,
    } satisfies PlanItem];
  });
}

export function itemsForLocalDay(items: PlanItem[], date: Date): PlanItem[] {
  const key = localDateKey(date);
  return items.filter((item) => localDateKey(item.start) === key);
}
