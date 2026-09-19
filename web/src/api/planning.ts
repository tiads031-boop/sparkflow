import { api } from './client';

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

export interface PlanningReplanRequest {
  requestId: string;
  title: string;
  blockedStart: string;
  blockedEnd: string;
  planningStart: string;
  planningEnd: string;
  reason: string;
}

export type PlanningActionProposal =
  | {
      proposalId: string;
      type: 'create_task';
      title: string;
      description?: string | null;
      priority?: 'high' | 'medium' | 'low';
      estimatedMinutes?: number | null;
      dueDate?: string | null;
      milestoneTitle?: string | null;
    }
  | {
      proposalId: string;
      type: 'update_task';
      taskId: string;
      taskTitle: string;
      changes: {
        title?: string;
        description?: string | null;
        priority?: 'high' | 'medium' | 'low';
        estimatedMinutes?: number | null;
        dueDate?: string | null;
      };
    };

export interface PlanningConversationRow {
  id: string;
  userMessage: string;
  aiResponse: string;
  context?: {
    readiness?: 'clarify' | 'ready';
    researchStatus?: 'not-needed' | 'used' | 'unavailable' | 'failed';
    evidenceIds?: string[];
    actions?: PlanningActionProposal[];
    appliedActionIds?: string[];
    replanRequests?: PlanningReplanRequest[];
  } | null;
  createdAt: string;
}

export interface PlanningThreadSummary {
  id: string;
  title: string | null;
  scopeType: string;
  scopeId: string | null;
  status: string;
  revision: number;
  updatedAt: string;
  _count?: { conversations: number; schedulePlans: number };
}

export interface PlanningThreadDetail extends PlanningThreadSummary {
  evidence: PlanningEvidenceItem[];
  conversations: PlanningConversationRow[];
  planningContext: PlanningContextSnapshot;
}

export interface PlanningTurnResponse {
  threadId: string;
  conversationId: string;
  revision: number;
  assistantMessage: string;
  readiness: 'clarify' | 'ready';
  openQuestions: string[];
  summary: string;
  research: {
    status: 'not-needed' | 'used' | 'unavailable' | 'failed';
    provider: string;
    evidence: PlanningEvidenceItem[];
  };
  actions: PlanningActionProposal[];
  replanRequests: PlanningReplanRequest[];
  planningContext: PlanningContextSnapshot;
}

export function listPlanningThreads(
  scopeType?: string,
  scopeId?: string,
) {
  const params = new URLSearchParams();
  if (scopeType) params.set('scopeType', scopeType);
  if (scopeId) params.set('scopeId', scopeId);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return api.get<PlanningThreadSummary[]>(`/planning/threads${suffix}`, {
    throwOnError: true,
  });
}

export function createPlanningThread(
  title?: string,
  scopeType = 'general',
  scopeId?: string,
) {
  return api.post<PlanningThreadSummary>(
    '/planning/threads',
    { title, scopeType, scopeId },
    { throwOnError: true },
  );
}

export function getPlanningThread(id: string) {
  return api.get<PlanningThreadDetail>(`/planning/threads/${id}`, {
    throwOnError: true,
  });
}

export function sendPlanningTurn(id: string, message: string, expectedRevision: number) {
  let timeZone = 'UTC';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // keep UTC fallback
  }
  return api.post<PlanningTurnResponse>(
    `/planning/threads/${id}/turn`,
    {
      message,
      expectedRevision,
      currentTime: new Date().toISOString(),
      timeZone,
    },
    { throwOnError: true, timeoutMs: 90_000 },
  );
}


export function updatePlanningContext(
  id: string,
  expectedRevision: number,
  data: Partial<Pick<PlanningContextSnapshot, 'brief' | 'constraints' | 'preferences' | 'strategy' | 'assumptions'>>,
) {
  return api.patch<PlanningThreadDetail>(
    `/planning/threads/${id}/context`,
    { expectedRevision, ...data },
    { throwOnError: true },
  );
}

export function getPlanningVoiceStatus() {
  return api.get<{ configured: boolean; model: string | null }>(
    '/planning/voice/status',
    { throwOnError: true },
  );
}

export function transcribePlanningAudio(blob: Blob) {
  const form = new FormData();
  const extension = blob.type.includes('mp4')
    ? 'm4a'
    : blob.type.includes('ogg')
      ? 'ogg'
      : blob.type.includes('wav')
        ? 'wav'
        : 'webm';
  form.append('audio', blob, `planning-voice.${extension}`);
  return api.post<{ text: string; model: string; bytes: number }>(
    '/planning/voice/transcribe',
    form,
    { throwOnError: true, timeoutMs: 75_000 },
  );
}


export function applyPlanningActions(
  threadId: string,
  conversationId: string,
  proposalIds: string[],
) {
  return api.post<{
    appliedActionIds: string[];
    createdTaskIds: string[];
    updatedTaskIds: string[];
  }>(
    `/planning/threads/${threadId}/actions/apply`,
    { conversationId, proposalIds },
    { throwOnError: true },
  );
}
