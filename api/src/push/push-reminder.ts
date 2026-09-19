export interface ReminderTask {
  id: string;
  userId: string;
  title: string;
  dueDate: Date | null;
  reminderAt: Date | null;
}

export const REMINDER_GRACE_MS = 10 * 60 * 1000;
export const DUE_SOON_MS = 30 * 60 * 1000;

export function reminderScheduledFor(task: ReminderTask): Date | null {
  if (task.reminderAt) return new Date(task.reminderAt);
  if (task.dueDate) return new Date(task.dueDate.getTime() - DUE_SOON_MS);
  return null;
}

export function groupReminderTasksByUser<T extends ReminderTask>(tasks: T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const task of tasks) {
    const bucket = grouped.get(task.userId) || [];
    bucket.push(task);
    grouped.set(task.userId, bucket);
  }
  return grouped;
}

export function buildReminderDeliveryKey(
  task: ReminderTask,
  subscriptionId: string,
): string {
  const scheduledFor = reminderScheduledFor(task);
  if (!scheduledFor) throw new Error('Reminder task has no reminder moment');
  return [
    'task',
    task.userId,
    task.id,
    scheduledFor.toISOString(),
    subscriptionId,
  ].join(':');
}

export function reminderWindow(now: Date) {
  return {
    reminderStart: new Date(now.getTime() - REMINDER_GRACE_MS),
    dueEnd: new Date(now.getTime() + DUE_SOON_MS),
  };
}
