import type { CalendarEvent, ScheduleItem, ScheduleSourceType, Task } from '../types';

const DEFAULT_DURATION_MINUTES = 60;

function validDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventSource(event: CalendarEvent): ScheduleSourceType {
  const source = event.externalSource?.toLowerCase();
  if (event.courseId || event.eventType?.toLowerCase() === 'course') return 'course';
  if (source?.includes('google') || event.eventType?.toLowerCase() === 'google') return 'google';
  if (source?.includes('local') || event.eventType?.toLowerCase() === 'local') return 'local';
  return 'calendar';
}

function sourceColor(type: ScheduleSourceType): string {
  if (type === 'course') return '#a9dedc';
  if (type === 'google') return '#a9c9ec';
  if (type === 'local') return '#ead887';
  return '#eeb6c8';
}

function taskStart(task: Task): Date | null {
  const scheduled = validDate(task.scheduledStart);
  if (scheduled) return scheduled;
  const due = validDate(task.dueDate);
  if (!due) return null;
  if (task.startTime) {
    const [hour, minute] = task.startTime.split(':').map(Number);
    if (Number.isFinite(hour) && Number.isFinite(minute)) due.setHours(hour, minute, 0, 0);
  }
  return due;
}

function addLocalDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfLocalDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function repeatsOn(task: Task, date: Date, anchor: Date): boolean {
  const rule = task.repeatRule?.toLowerCase();
  if (!rule) return false;
  const targetDay = startOfLocalDay(date);
  const anchorDay = startOfLocalDay(validDate(task.repeatStartDate) ?? anchor);
  const repeatEnd = validDate(task.repeatEndDate);
  if (targetDay < anchorDay || (repeatEnd && targetDay > startOfLocalDay(repeatEnd))) return false;
  if (rule === 'daily') return true;
  if (rule === 'weekly') return targetDay.getDay() === anchorDay.getDay();
  if (rule === 'monthly') return targetDay.getDate() === anchorDay.getDate();
  return false;
}

function projectedTask(task: Task, start: Date, id = `task:${task.id}`): ScheduleItem {
  const explicitEnd = task.scheduledStart ? validDate(task.scheduledEnd) : null;
  const duration = Math.max(1, task.estimatedMinutes ?? task.duration ?? DEFAULT_DURATION_MINUTES);
  const end = explicitEnd && explicitEnd > start
    ? explicitEnd
    : new Date(start.getTime() + duration * 60_000);
  return {
    id,
    sourceType: 'task',
    sourceId: task.id,
    taskId: task.id,
    title: task.title,
    start: start.toISOString(),
    end: end.toISOString(),
    durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
    color: task.scheduleColor || '#b0a8db',
    locked: task.scheduleLocked ?? false,
    completed: task.status === 'Done',
  };
}

export function projectScheduleItems(tasks: readonly Task[], events: readonly CalendarEvent[]): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const projectedTaskIds = new Set<string>();

  for (const task of tasks) {
    const start = taskStart(task);
    if (!start || task.status === 'Cancelled') continue;
    items.push(projectedTask(task, start));
    projectedTaskIds.add(task.id);
  }

  for (const event of events) {
    const linkedTaskId = event.taskId ?? event.extendedProps?.taskId;
    if (linkedTaskId && projectedTaskIds.has(linkedTaskId)) continue;
    const start = validDate(event.startTime);
    const end = validDate(event.endTime);
    if (!start || !end || end <= start) continue;
    const sourceType = eventSource(event);
    items.push({
      id: `event:${event.id}`,
      sourceType,
      sourceId: event.id,
      taskId: linkedTaskId || undefined,
      title: event.title,
      start: start.toISOString(),
      end: end.toISOString(),
      durationMinutes: Math.round((end.getTime() - start.getTime()) / 60_000),
      color: event.color || sourceColor(sourceType),
      locked: event.scheduleLocked ?? ['course', 'google', 'local'].includes(sourceType),
      completed: false,
      location: event.location || undefined,
    });
  }

  return items.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}

/** Expands supported legacy repeat rules inside a bounded local-time range. */
export function projectScheduleItemsForRange(
  tasks: readonly Task[],
  events: readonly CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): ScheduleItem[] {
  const baseItems = projectScheduleItems(tasks.filter((task) => !task.repeatRule), events);
  const repeatingTaskIds = new Set(tasks.filter((task) => task.repeatRule).map((task) => task.id));
  const items = baseItems.filter((item) => (
    !item.taskId || !repeatingTaskIds.has(item.taskId)
  ) && new Date(item.start) < rangeEnd && new Date(item.end) > rangeStart);

  for (const task of tasks) {
    if (!task.repeatRule || task.status === 'Cancelled') continue;
    const anchor = taskStart(task);
    if (!anchor) continue;
    const duration = Math.max(1, task.estimatedMinutes ?? task.duration ?? DEFAULT_DURATION_MINUTES);
    for (let day = startOfLocalDay(rangeStart); day < rangeEnd; day = addLocalDays(day, 1)) {
      if (!repeatsOn(task, day, anchor)) continue;
      const start = new Date(day);
      start.setHours(anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), anchor.getMilliseconds());
      const item = projectedTask(task, start, `task:${task.id}:${start.toISOString()}`);
      item.end = new Date(start.getTime() + duration * 60_000).toISOString();
      item.durationMinutes = duration;
      items.push(item);
    }
  }

  return items.sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
}
