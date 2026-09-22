import type { GoalProgressSummary, StudyFolder } from '../types';

export type GoalProgressType = 'task' | 'numeric' | 'time';

export function goalProgressType(goal: StudyFolder): GoalProgressType {
  return goal.progressType === 'numeric' || goal.progressType === 'time'
    ? goal.progressType
    : 'task';
}

export function goalProgressLabel(type: GoalProgressType) {
  if (type === 'numeric') return '数值进度';
  if (type === 'time') return '专注投入';
  return '任务进度';
}

export function formatProgressValue(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString('zh-CN')
    : value.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}

export function progressBarWidth(percent: number | null) {
  return Math.min(100, Math.max(0, percent ?? 0));
}

export function progressHeadline(summary: GoalProgressSummary) {
  const current = formatProgressValue(summary.primary.current);
  const target = summary.primary.target === null
    ? null
    : formatProgressValue(summary.primary.target);
  return target
    ? `${current} / ${target} ${summary.primary.unit}`
    : `${current} ${summary.primary.unit}`;
}
