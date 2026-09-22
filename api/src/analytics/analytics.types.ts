export type AnalyticsBucket = 'day' | 'week' | 'month';
export type AnalyticsDimension = 'tag' | 'goal' | 'scene' | 'source';
export type PlanActualGroup = 'day' | 'tag' | 'goal';

export interface ActualFact {
  id: string;
  taskId: string | null;
  title: string;
  start: Date;
  end: Date;
  effectiveDurationSeconds: number;
  source: 'focus' | 'manual';
  tags: string[];
  goal: { id: string; label: string; color?: string } | null;
}

export interface PlannedFact {
  id: string;
  taskId: string | null;
  title: string;
  start: Date;
  end: Date;
  tags: string[];
  goal: { id: string; label: string; color?: string } | null;
  source: 'task' | 'course' | 'calendar';
}

export type MatchConfidence = 'exact' | 'strong' | 'inferred' | 'none';
export type ExecutionRelation =
  | 'on_time'
  | 'early'
  | 'late'
  | 'longer'
  | 'shorter'
  | 'unplanned';

export interface AnalyticsMatch {
  actualId: string;
  plannedId?: string;
  relation: ExecutionRelation;
  confidence: MatchConfidence;
  startDeltaMinutes?: number;
  durationDeltaMinutes?: number;
}
