import type { Task } from '../types';

export type TaskQuadrant = 'important-urgent' | 'important-later' | 'urgent' | 'later';

export const QUADRANT_ORDER: readonly TaskQuadrant[] = [
  'important-urgent',
  'important-later',
  'urgent',
  'later',
];

export const QUADRANT_META: Record<TaskQuadrant, { title: string; hint: string; color: string }> = {
  'important-urgent': { title: '立即处理', hint: '重要且紧急', color: 'var(--sf-marker-pink)' },
  'important-later': { title: '计划推进', hint: '重要不紧急', color: 'var(--sf-marker-purple)' },
  urgent: { title: '尽快完成', hint: '紧急不重要', color: 'var(--sf-marker-yellow)' },
  later: { title: '有空再做', hint: '不紧急不重要', color: 'var(--sf-marker-green)' },
};

export function getTaskQuadrant(task: Task, now = Date.now(), urgencyWindowHours = 72): TaskQuadrant {
  const important = task.priority === 'High Priority';
  const deadline = task.dueDate ? new Date(task.dueDate).getTime() : Number.NaN;
  const urgent = Number.isFinite(deadline) && deadline <= now + urgencyWindowHours * 60 * 60 * 1000;

  if (important && urgent) return 'important-urgent';
  if (important) return 'important-later';
  if (urgent) return 'urgent';
  return 'later';
}

export function groupTasksByQuadrant(tasks: Task[], now = Date.now()) {
  const groups: Record<TaskQuadrant, Task[]> = {
    'important-urgent': [],
    'important-later': [],
    urgent: [],
    later: [],
  };
  for (const task of tasks) {
    if (task.status === 'Done' || task.status === 'Cancelled') continue;
    groups[getTaskQuadrant(task, now)].push(task);
  }
  return groups;
}
