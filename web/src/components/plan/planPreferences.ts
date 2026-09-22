import type { PlanView } from '../../types';

export const PLAN_VIEW_STORAGE_KEY = 'sparkflow.lastPlanView';

const planViews: readonly PlanView[] = ['month', 'week', 'agenda', 'timeline', 'gantt'];

export function isPlanView(value: unknown): value is PlanView {
  return typeof value === 'string' && planViews.includes(value as PlanView);
}

export function readLastPlanView(): PlanView {
  if (typeof window === 'undefined') return 'week';
  try {
    const stored = window.localStorage.getItem(PLAN_VIEW_STORAGE_KEY);
    return isPlanView(stored) ? stored : 'week';
  } catch {
    return 'week';
  }
}

export function writeLastPlanView(view: PlanView) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PLAN_VIEW_STORAGE_KEY, view);
  } catch {
    // Keep current-session navigation working when storage is unavailable.
  }
}
