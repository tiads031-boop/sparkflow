export type InsightType = 'theme' | 'evolution' | 'action';

export interface InsightCandidate {
  id: string;
  title: string | null;
  description: string | null;
  contentText: string | null;
  tags: string[];
  createdAt: string;
  reflections: Array<{
    body: string;
    createdAt: string;
  }>;
}

export interface GeneratedInsight {
  title: string;
  body: string;
  type: InsightType;
  sourceIds: string[];
}

export interface InsightGenerationInput {
  records: InsightCandidate[];
}

export interface AIProvider {
  readonly modelName: string;
  generateInsights(input: InsightGenerationInput): Promise<GeneratedInsight[]>;
  generatePlanningTurn(input: PlanningTurnInput): Promise<PlanningTurnResult>;
  summarizeText(input: { text: string; context?: string }): Promise<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

export const PLANNING_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type PlanningModel = (typeof PLANNING_MODELS)[number];


export type PlanningFactStatus = 'confirmed' | 'inferred' | 'assumed';

export interface PlanningFact {
  key: string;
  value: string;
  status: PlanningFactStatus;
}

export interface PlanningContextSnapshot {
  brief: PlanningFact[];
  constraints: PlanningFact[];
  preferences: PlanningFact[];
  strategy: PlanningFact[];
  assumptions: PlanningFact[];
  revision: number;
}

export interface PlanningConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PlanningResearchRequest {
  query: string;
  reason: string;
  highImpact: boolean;
  preferOfficial: boolean;
}

export interface PlanningEvidenceItem {
  id: string;
  query: string;
  title: string;
  url: string;
  domain: string;
  snippet: string;
  sourceType: 'official' | 'primary' | 'secondary' | 'community' | 'unknown';
  fetchedAt: string;
  expiresAt: string;
  highImpact: boolean;
}

export interface PlanningTaskSnapshot {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  dueDate: string | null;
  estimatedMinutes: number | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleLocked: boolean;
  project: string | null;
  tags: string[];
}

export interface PlanningCourseSnapshot {
  id: string;
  name: string;
  teacher: string | null;
  room: string | null;
  location: string | null;
  dayOfWeek: number | null;
  startTime: string | null;
  endTime: string | null;
  semesterId: string | null;
}

export interface PlanningCourseOccurrenceSnapshot {
  id: string;
  courseId: string;
  courseName: string;
  title: string;
  startTime: string;
  endTime: string;
  location: string | null;
  overrideType: string | null;
  overrideOriginalStart: string | null;
}

export interface PlanningHolidayDaySnapshot {
  date: string;
  name: string | null;
  isOffDay: boolean;
}

export interface PlanningSceneSnapshot {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string | null;
  category: string | null;
  fieldSchema: unknown[];
  triggers: string[];
  allowedViews: string[];
}

export interface PlanningSceneDraft {
  name?: string;
  emoji?: string;
  color?: string;
  description?: string | null;
  category?: string | null;
  fieldSchema?: unknown[];
  triggers?: string[];
  allowedViews?: string[];
}

export type PlanningCourseChangeRequest =
  | {
      type: 'reschedule';
      eventId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
    }
  | {
      type: 'cancel';
      eventId: string;
    }
  | {
      type: 'extra';
      courseId: string;
      startTime: string;
      endTime: string;
      location?: string | null;
      title?: string;
    }
  | {
      type: 'swap';
      eventId: string;
      otherEventId: string;
    };

export type PlanningActionDraft =
  | {
      type: 'create_task';
      title: string;
      description?: string | null;
      priority?: 'high' | 'medium' | 'low';
      estimatedMinutes?: number | null;
      dueDate?: string | null;
      milestoneTitle?: string | null;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      folderName?: string | null;
      tags?: string[];
    }
  | {
      type: 'update_task';
      taskId: string;
      taskTitle: string;
      changes: {
        title?: string;
        description?: string | null;
        priority?: 'high' | 'medium' | 'low';
        estimatedMinutes?: number | null;
        dueDate?: string | null;
        milestoneTitle?: string | null;
        scheduledStart?: string | null;
        scheduledEnd?: string | null;
        folderName?: string | null;
        tags?: string[];
      };
    }
  | {
      type: 'update_goal';
      goalTitle: string;
      changes: {
        name?: string;
        description?: string | null;
      };
    }
  | {
      type: 'course_change';
      courseName: string;
      otherCourseName?: string;
      change: PlanningCourseChangeRequest;
    }
  | {
      type: 'course_template_change';
      courseId: string;
      courseName: string;
      effectiveFrom: string;
      changes: {
        dayOfWeek?: number;
        startTime?: string;
        endTime?: string;
        room?: string | null;
        location?: string | null;
      };
    }
  | {
      type: 'delete_course';
      courseId: string;
      courseName: string;
    }
  | ({
      type: 'create_scene';
      name: string;
    } & Omit<PlanningSceneDraft, 'name'>)
  | {
      type: 'update_scene';
      sceneId: string;
      sceneName: string;
      changes: PlanningSceneDraft;
    };

export type PlanningActionProposal = PlanningActionDraft & {
  proposalId: string;
};

export interface PlanningReplanDraft {
  title: string;
  blockedStart: string;
  blockedEnd: string;
  planningStart: string;
  planningEnd: string;
  reason: string;
}

export interface PlanningReplanRequest extends PlanningReplanDraft {
  requestId: string;
}

export interface PlanningScopeSnapshot {
  type: string;
  id: string | null;
  title: string | null;
}

export interface PlanningGoalMilestoneExecution {
  title: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
}

export interface PlanningGoalExecutionSnapshot {
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  completedLast7Days: number;
  focusMinutesLast7Days: number;
  recentlyCompletedTitles: string[];
  milestones: PlanningGoalMilestoneExecution[];
}

export interface PlanningTurnInput {
  model: PlanningModel;
  message: string;
  context: PlanningContextSnapshot;
  recentMessages: PlanningConversationMessage[];
  currentTasks?: PlanningTaskSnapshot[];
  currentTags?: string[];
  currentCourses?: PlanningCourseSnapshot[];
  currentCourseOccurrences?: PlanningCourseOccurrenceSnapshot[];
  currentScenes?: PlanningSceneSnapshot[];
  holidayCalendar?: PlanningHolidayDaySnapshot[];
  planningScope?: PlanningScopeSnapshot;
  goalExecution?: PlanningGoalExecutionSnapshot;
  currentTime?: string;
  timeZone?: string;
  evidence?: PlanningEvidenceItem[];
  researchAllowed?: boolean;
  researchUnavailableReason?: string;
}

export interface PlanningTurnResult {
  reply: string;
  readiness: 'clarify' | 'ready';
  context: Omit<PlanningContextSnapshot, 'revision'>;
  openQuestions: string[];
  summary: string;
  researchQueries: PlanningResearchRequest[];
  actions: PlanningActionDraft[];
  replanRequests: PlanningReplanDraft[];
}
