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

export function projectScheduleItems(tasks: readonly Task[], events: readonly CalendarEvent[]): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  const projectedTaskIds = new Set<string>();

  for (const task of tasks) {
    const start = validDate(task.scheduledStart);
    if (!start || task.status === 'Cancelled') continue;
    const explicitEnd = validDate(task.scheduledEnd);
    const duration = Math.max(1, task.estimatedMinutes ?? task.duration ?? DEFAULT_DURATION_MINUTES);
    const end = explicitEnd && explicitEnd > start
      ? explicitEnd
      : new Date(start.getTime() + duration * 60_000);
    items.push({
      id: `task:${task.id}`,
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
    });
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
