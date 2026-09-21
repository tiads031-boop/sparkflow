import type { ActualTimelineEntry } from '../../api/actualTimeline';
import type { Task } from '../../types';
import { localDateKey, type PlanItem } from '../plan/planProjection.ts';

export interface TodayMetricValues {
  actualSeconds: number;
  completedTasks: number;
  relevantTasks: number;
  pendingItems: number;
}

export function calculateTodayMetrics(
  date: Date,
  tasks: Task[],
  plannedItems: PlanItem[],
  actualEntries: ActualTimelineEntry[],
  now = new Date(),
): TodayMetricValues {
  const dateKey = localDateKey(date);
  const relevantTasks = tasks.filter((task) =>
    [task.scheduledStart, task.dueDate, task.completedAt]
      .some((value) => value && localDateKey(value) === dateKey),
  );
  const completedTasks = relevantTasks.filter((task) => task.status === 'Done').length;
  const pendingItems = plannedItems.filter((item) =>
    !item.preview && !item.completed && new Date(item.end).getTime() > now.getTime(),
  ).length;

  return {
    actualSeconds: actualEntries.reduce(
      (total, entry) => total + Math.max(0, entry.effectiveDurationSeconds),
      0,
    ),
    completedTasks,
    relevantTasks: relevantTasks.length,
    pendingItems,
  };
}

export function formatMetricDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
