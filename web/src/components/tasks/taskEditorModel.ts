import type { Task, TaskSection } from '../../types';

export type RepeatRule = 'none' | 'daily' | 'weekly' | 'monthly';

export const taskPriorities: Array<{ value: Task['priority']; label: string }> = [
  { value: 'High Priority', label: '高' },
  { value: 'Medium', label: '中' },
  { value: 'Low', label: '低' },
];

export const taskDurations = [15, 30, 45, 60, 90, 120];

export interface TaskEditorSectionOption {
  value: TaskSection;
  label: string;
}

export function localTaskDateTime(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function localTaskDate(value?: string) {
  return localTaskDateTime(value).slice(0, 10);
}
