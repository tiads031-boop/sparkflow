import type { PlannedFact } from './analytics.types';

interface GoalLink {
  folder: { id: string; name: string; color: string };
}

interface PlannedTaskRow {
  id: string;
  title: string;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  estimatedMinutes: number | null;
  tags: string[];
  project: string | null;
  studyFolders: GoalLink[];
}

interface CalendarEventRow {
  id: string;
  taskId: string | null;
  courseId: string | null;
  focusSessionId: string | null;
  title: string;
  eventType: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  task: Pick<PlannedTaskRow, 'tags' | 'project' | 'studyFolders'> | null;
}

function goalFromTask(
  task: Pick<PlannedTaskRow, 'project' | 'studyFolders'> | null,
) {
  const folder = task?.studyFolders[0]?.folder;
  if (folder) return { id: folder.id, label: folder.name, color: folder.color };
  if (task?.project) return { id: task.project, label: task.project };
  return null;
}

export function projectPlannedFacts(
  events: CalendarEventRow[],
  tasks: PlannedTaskRow[],
): PlannedFact[] {
  const facts: PlannedFact[] = [];
  const taskIdsWithEvents = new Set<string>();
  const eventKeys = new Set<string>();

  for (const event of events) {
    if (
      event.focusSessionId ||
      event.eventType === 'focus' ||
      event.isAllDay ||
      event.endTime.getTime() <= event.startTime.getTime()
    )
      continue;
    const eventKey = [
      event.courseId ?? event.taskId ?? '',
      event.title.trim().toLocaleLowerCase(),
      event.startTime.toISOString(),
      event.endTime.toISOString(),
    ].join(':');
    if (eventKeys.has(eventKey)) continue;
    eventKeys.add(eventKey);
    if (event.taskId) taskIdsWithEvents.add(event.taskId);
    facts.push({
      id: `event:${event.id}`,
      taskId: event.taskId,
      title: event.title,
      start: event.startTime,
      end: event.endTime,
      tags: event.task?.tags ?? [],
      goal: goalFromTask(event.task),
      source:
        event.courseId || event.eventType === 'course' ? 'course' : 'calendar',
    });
  }

  for (const task of tasks) {
    if (!task.scheduledStart || taskIdsWithEvents.has(task.id)) continue;
    const end =
      task.scheduledEnd ??
      new Date(
        task.scheduledStart.getTime() +
          Math.max(1, task.estimatedMinutes ?? 30) * 60_000,
      );
    if (end.getTime() <= task.scheduledStart.getTime()) continue;
    facts.push({
      id: `task:${task.id}`,
      taskId: task.id,
      title: task.title,
      start: task.scheduledStart,
      end,
      tags: task.tags,
      goal: goalFromTask(task),
      source: 'task',
    });
  }

  return facts.sort(
    (left, right) => left.start.getTime() - right.start.getTime(),
  );
}
