import { addLocalDays, getMonday, type PlanItem } from './planProjection.ts';

export const GANTT_DAY_WIDTH = 46;
export const GANTT_DAYS = 14;

export function ganttDayOffset(date: Date, rangeStart: Date): number {
  const start = Date.UTC(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((current - start) / 86_400_000);
}

export function ganttRange(date: Date) {
  const start = getMonday(date);
  return { start, end: addLocalDays(start, GANTT_DAYS) };
}

export function proposeGanttAdjustment(item: PlanItem, days: number, mode: 'move' | 'resize') {
  if (!item.taskId || item.preview || (item.kind !== 'task' && item.kind !== 'study-task') || !days) return null;
  const start = new Date(item.start);
  const end = new Date(item.end);
  if (end <= start) return null;
  const shiftedStart = mode === 'move' ? addLocalDays(start, days) : start;
  const shiftedEnd = addLocalDays(end, days);
  if (shiftedEnd.getTime() - shiftedStart.getTime() < 15 * 60_000) return null;
  return { start: shiftedStart, end: shiftedEnd };
}
