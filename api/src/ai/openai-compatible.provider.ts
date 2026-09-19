import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AIProvider,
  GeneratedInsight,
  InsightGenerationInput,
  InsightType,
  PlanningActionDraft,
  PlanningFact,
  PlanningFactStatus,
  PlanningReplanDraft,
  PlanningResearchRequest,
  PlanningTurnInput,
  PlanningTurnResult,
} from './ai-provider';

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
    if (fenced) {
      try {
        return JSON.parse(fenced.trim());
      } catch {
        // Fall through to the first-object fallback below.
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error('AI provider returned invalid JSON');
  }
}

function toGeneratedInsights(value: unknown): GeneratedInsight[] {
  if (!value || typeof value !== 'object') return [];
  const items = (value as { insights?: unknown }).insights;
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const type = candidate.type;
    if (!['theme', 'evolution', 'action'].includes(String(type))) return [];
    if (typeof candidate.title !== 'string' || typeof candidate.body !== 'string') return [];
    if (!Array.isArray(candidate.sourceIds)) return [];
    return [{
      title: candidate.title,
      body: candidate.body,
      type: type as InsightType,
      sourceIds: candidate.sourceIds.filter((id): id is string => typeof id === 'string'),
    }];
  });
}

function toPlanningFacts(value: unknown): PlanningFact[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    const status = String(candidate.status || '');
    if (!['confirmed', 'inferred', 'assumed'].includes(status)) return [];
    if (typeof candidate.key !== 'string' || typeof candidate.value !== 'string') return [];
    const key = candidate.key.trim().slice(0, 80);
    const factValue = candidate.value.trim().slice(0, 500);
    if (!key || !factValue) return [];
    return [{ key, value: factValue, status: status as PlanningFactStatus }];
  });
}

function normalizedDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function normalizedPriority(value: unknown): 'high' | 'medium' | 'low' | undefined {
  return ['high', 'medium', 'low'].includes(String(value))
    ? value as 'high' | 'medium' | 'low'
    : undefined;
}

function normalizedMinutes(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(5, Math.min(720, Math.round(value)));
}

function toPlanningActions(value: unknown): PlanningActionDraft[] {
  if (!Array.isArray(value)) return [];
  const actions: PlanningActionDraft[] = [];

  for (const item of value.slice(0, 8)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;

    if (candidate.type === 'create_task') {
      if (typeof candidate.title !== 'string' || !candidate.title.trim()) continue;
      const action: Extract<PlanningActionDraft, { type: 'create_task' }> = {
        type: 'create_task',
        title: candidate.title.trim().slice(0, 200),
      };
      if (typeof candidate.description === 'string') {
        action.description = candidate.description.trim().slice(0, 2000) || null;
      } else if (candidate.description === null) {
        action.description = null;
      }
      const priority = normalizedPriority(candidate.priority);
      const estimatedMinutes = normalizedMinutes(candidate.estimatedMinutes);
      const dueDate = normalizedDate(candidate.dueDate);
      if (priority) action.priority = priority;
      if (estimatedMinutes !== undefined) action.estimatedMinutes = estimatedMinutes;
      if (dueDate !== undefined) action.dueDate = dueDate;
      if (typeof candidate.milestoneTitle === 'string') {
        action.milestoneTitle = candidate.milestoneTitle.trim().slice(0, 120) || null;
      } else if (candidate.milestoneTitle === null) {
        action.milestoneTitle = null;
      }
      actions.push(action);
      continue;
    }

    if (candidate.type === 'update_goal') {
      if (
        typeof candidate.goalTitle !== 'string' ||
        !candidate.goalTitle.trim() ||
        !candidate.changes ||
        typeof candidate.changes !== 'object'
      ) continue;
      const rawChanges = candidate.changes as Record<string, unknown>;
      const changes: Extract<PlanningActionDraft, { type: 'update_goal' }>['changes'] = {};
      if (typeof rawChanges.name === 'string' && rawChanges.name.trim()) {
        changes.name = rawChanges.name.trim().slice(0, 120);
      }
      if (typeof rawChanges.description === 'string') {
        changes.description = rawChanges.description.trim().slice(0, 2000) || null;
      } else if (rawChanges.description === null) {
        changes.description = null;
      }
      if (!Object.keys(changes).length) continue;

      actions.push({
        type: 'update_goal',
        goalTitle: candidate.goalTitle.trim().slice(0, 120),
        changes,
      });
      continue;
    }

    if (candidate.type === 'update_task') {
      if (
        typeof candidate.taskId !== 'string' ||
        !candidate.taskId.trim() ||
        typeof candidate.taskTitle !== 'string' ||
        !candidate.taskTitle.trim() ||
        !candidate.changes ||
        typeof candidate.changes !== 'object'
      ) continue;
      const rawChanges = candidate.changes as Record<string, unknown>;
      const changes: Extract<PlanningActionDraft, { type: 'update_task' }>['changes'] = {};
      if (typeof rawChanges.title === 'string' && rawChanges.title.trim()) {
        changes.title = rawChanges.title.trim().slice(0, 200);
      }
      if (typeof rawChanges.description === 'string') {
        changes.description = rawChanges.description.trim().slice(0, 2000) || null;
      } else if (rawChanges.description === null) {
        changes.description = null;
      }
      const priority = normalizedPriority(rawChanges.priority);
      const estimatedMinutes = normalizedMinutes(rawChanges.estimatedMinutes);
      const dueDate = normalizedDate(rawChanges.dueDate);
      if (priority) changes.priority = priority;
      if (estimatedMinutes !== undefined) changes.estimatedMinutes = estimatedMinutes;
      if (dueDate !== undefined) changes.dueDate = dueDate;
      if (typeof rawChanges.milestoneTitle === 'string') {
        changes.milestoneTitle = rawChanges.milestoneTitle.trim().slice(0, 120) || null;
      } else if (rawChanges.milestoneTitle === null) {
        changes.milestoneTitle = null;
      }
      if (!Object.keys(changes).length) continue;

      const action: Extract<PlanningActionDraft, { type: 'update_task' }> = {
        type: 'update_task',
        taskId: candidate.taskId.trim().slice(0, 100),
        taskTitle: candidate.taskTitle.trim().slice(0, 200),
        changes,
      };
      actions.push(action);
    }
  }

  return actions;
}

function toReplanRequests(value: unknown): PlanningReplanDraft[] {
  if (!Array.isArray(value)) return [];
  const requests: PlanningReplanDraft[] = [];

  for (const item of value.slice(0, 3)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.title !== 'string' ||
      typeof candidate.reason !== 'string'
    ) continue;

    const blockedStart = normalizedDate(candidate.blockedStart);
    const blockedEnd = normalizedDate(candidate.blockedEnd);
    const planningStart = normalizedDate(candidate.planningStart);
    const planningEnd = normalizedDate(candidate.planningEnd);
    if (
      typeof blockedStart !== 'string' ||
      typeof blockedEnd !== 'string' ||
      typeof planningStart !== 'string' ||
      typeof planningEnd !== 'string'
    ) continue;
    if (
      new Date(blockedEnd) <= new Date(blockedStart) ||
      new Date(planningEnd) <= new Date(planningStart)
    ) continue;

    requests.push({
      title: candidate.title.trim().slice(0, 160) || '临时冲突重排',
      blockedStart,
      blockedEnd,
      planningStart,
      planningEnd,
      reason: candidate.reason.trim().slice(0, 500),
    });
  }

  return requests;
}

function toResearchQueries(value: unknown): PlanningResearchRequest[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.query !== 'string' || typeof candidate.reason !== 'string') return [];
    const query = candidate.query.trim().slice(0, 300);
    const reason = candidate.reason.trim().slice(0, 500);
    if (!query || !reason) return [];
    return [{
      query,
      reason,
      highImpact: candidate.highImpact === true,
      preferOfficial: candidate.preferOfficial !== false,
    }];
  });
}

export function toPlanningTurn(value: unknown): PlanningTurnResult {
  if (!value || typeof value !== 'object') throw new Error('AI planning response is invalid');
  const candidate = value as Record<string, unknown>;
  const readiness = candidate.readiness;
  if (readiness !== 'clarify' && readiness !== 'ready') {
    throw new Error('AI planning response has invalid readiness');
  }
  if (typeof candidate.reply !== 'string' || !candidate.reply.trim()) {
    throw new Error('AI planning response has no reply');
  }
  if (!candidate.context || typeof candidate.context !== 'object') {
    throw new Error('AI planning response has no context');
  }
  const context = candidate.context as Record<string, unknown>;
  for (const section of ['brief', 'constraints', 'preferences', 'strategy', 'assumptions']) {
    if (!Array.isArray(context[section])) {
      throw new Error(`AI planning response is missing ${section}`);
    }
  }
  const openQuestions = Array.isArray(candidate.openQuestions)
    ? candidate.openQuestions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    reply: candidate.reply.trim().slice(0, 4000),
    readiness,
    context: {
      brief: toPlanningFacts(context.brief),
      constraints: toPlanningFacts(context.constraints),
      preferences: toPlanningFacts(context.preferences),
      strategy: toPlanningFacts(context.strategy),
      assumptions: toPlanningFacts(context.assumptions),
    },
    openQuestions,
    summary: typeof candidate.summary === 'string'
      ? candidate.summary.trim().slice(0, 1000)
      : '',
    researchQueries: toResearchQueries(candidate.researchQueries),
    actions: toPlanningActions(candidate.actions),
    replanRequests: toReplanRequests(candidate.replanRequests),
  };
}

const PROVIDER_TIMEOUT_MS = 60_000;
const RETRYABLE_PROVIDER_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response: Response) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 5_000);
  }
  return 1_200;
}

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  constructor(private readonly config: ConfigService) {}

  private providerName() {
    return (this.config.get<string>('AI_PROVIDER') || 'openai').trim().toLowerCase();
  }

  private apiKey() {
    const explicit = this.config.get<string>('AI_API_KEY')?.trim();
    if (explicit) return explicit;
    if (this.providerName() === 'deepseek') return this.config.get<string>('DEEPSEEK_API_KEY')?.trim() || '';
    return this.config.get<string>('OPENAI_API_KEY')?.trim() || '';
  }

  private baseUrl() {
    const explicit = this.config.get<string>('AI_BASE_URL')?.trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    return this.providerName() === 'deepseek'
      ? 'https://api.deepseek.com'
      : 'https://api.openai.com/v1';
  }

  get modelName() {
    const explicit = this.config.get<string>('AI_MODEL')?.trim();
    if (explicit) return explicit;
    return this.providerName() === 'deepseek' ? 'deepseek-chat' : 'gpt-4.1-mini';
  }

  async generateInsights(input: InsightGenerationInput): Promise<GeneratedInsight[]> {
    const key = this.apiKey();
    if (!key) throw new Error('AI provider is not configured');

    const baseUrl = this.baseUrl();
    const isQwenPlatform = /dashscope\.aliyuncs\.com/i.test(baseUrl);
    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      temperature: 0.25,
      max_tokens: 1400,
      messages: [
        {
          role: 'system',
          content: [
            'You synthesize personal notes into explainable insights.',
            'Return one JSON object only: {"insights":[...]}.',
            'Each insight must use type theme, evolution, or action.',
            'Every insight must cite at least two sourceIds copied exactly from the provided records.',
            'Never invent ids, facts, people, dates, or conclusions not supported by the records.',
            'theme = a recurring principle/problem/direction; evolution = a meaningful change over time; action = a concrete opportunity supported by repeated notes.',
            'Write title and body in the dominant language of the user records.',
            'Prefer 1-4 strong insights. If evidence is weak, return {"insights":[]}.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({ records: input.records }),
        },
      ],
    };

    // Qwen 3.7 Plus defaults to thinking mode, which is unnecessarily slow for
    // this constrained synthesis task. JSON mode also requires thinking to be off.
    if (isQwenPlatform) {
      requestBody.enable_thinking = false;
      requestBody.response_format = { type: 'json_object' };
    }

    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;
      if (attempt === 0 && RETRYABLE_PROVIDER_STATUSES.has(response.status)) {
        await sleep(retryDelayMs(response));
        continue;
      }
      throw new Error(`AI provider request failed (${response.status})`);
    }

    if (!response?.ok) throw new Error('AI provider request failed');
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned an empty response');
    return toGeneratedInsights(extractJsonObject(content));
  }

  async generatePlanningTurn(input: PlanningTurnInput): Promise<PlanningTurnResult> {
    const key = this.apiKey();
    if (!key) throw new Error('AI provider is not configured');

    const baseUrl = this.baseUrl();
    const isQwenPlatform = /dashscope\.aliyuncs\.com/i.test(baseUrl);
    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      temperature: 0.2,
      max_tokens: 2200,
      messages: [
        {
          role: 'system',
          content: [
            'You are the planning interviewer inside SparkFlow.',
            'Your job is to understand the user deeply enough to make a reliable plan, not to rush into scheduling.',
            'Ask the highest-impact missing questions first. There is no fixed number of questions.',
            'When enough high-impact information is known, set readiness to ready.',
            'The user may ask to plan now with incomplete information. Then mark uncertain items as assumed, never confirmed.',
            'Preserve previously confirmed facts unless the user explicitly changes them.',
            'Distinguish confirmed user facts, inferred interpretations, and temporary assumptions.',
            'strategy must explain the currently chosen planning approach and why it fits the known context.',
            'Do not invent external facts such as exam dates, official rules, opening hours, prices, travel times, or current product requirements.',
            'If the plan materially depends on current external facts and the supplied evidence is insufficient, request web research.',
            'When researchAllowed is false, do not emit new researchQueries; instead explain any remaining uncertainty and continue only with the supplied evidence.',
            'Request at most 3 focused searches. Mark highImpact true when an incorrect fact could change eligibility, deadlines, cost, travel feasibility, or the plan itself.',
            'Prefer official/first-party sources for high-impact facts.',
            'When evidence is provided, distinguish user facts from external evidence. Do not silently convert external search results into confirmed personal facts.',
            'If evidence conflicts or is weak, say so in the reply and keep readiness clarify when the unresolved fact materially affects the plan.',
            'When the user clearly asks to create a new actionable task, you may propose create_task.',
            'When the user clearly asks to change an existing task, you may propose update_task, but taskId must be copied exactly from currentTasks.',
            'Do not create task actions from vague goals, brainstorms, or unresolved questions. Ask first when important task details are unclear.',
            'Task actions are only drafts for user confirmation. Never claim they are already applied.',
            'Do not propose direct calendar/course mutations in this phase.',
            'When planningScope.type is goal, treat it as a persistent long-term learning goal, not as a Course.',
            'For goal scope, goalExecution is a derived execution snapshot from the user\'s real Tasks and completed focus sessions. Use it to understand pace and friction, but never equate task completion with actual mastery.',
            'When execution is behind or uneven, ask about causes that materially affect the plan before making large changes; do not punish the user by simply adding more tasks.',
            'For goal scope, keep interviewing until success criteria, current level, resources, time budget, important preferences/tradeoffs, and high-impact external facts are sufficiently known or explicitly assumed.',
            'If the user explicitly changes, renames, narrows, broadens, or replaces the learning goal itself, you may propose update_goal. update_goal is only valid for goal scope and must be a reviewable draft, never an already-applied change.',
            'Do not change the learning goal merely because progress is slow; changing the goal requires explicit user intent.',
            'When the goal is ready for execution and the user wants a concrete plan, group create_task drafts into a small number of meaningful stages/milestones using milestoneTitle.',
            'When adjusting an existing goal plan, update_task.changes.milestoneTitle may move an existing goal task to another stage, or null may remove the stage label.',
            'milestoneTitle is an organizational label, not a second task system. Prefer outcome-oriented stage names such as 基础建立 / 强化训练 / 模拟冲刺.',
            'Do not create arbitrary busywork just to fill stages; each task should materially advance the confirmed goal.',
            'If a temporary real-world conflict blocks an interval and the user asks to move affected flexible tasks, you may propose a replanRequest.',
            'A replanRequest must contain exact ISO instants for blockedStart/blockedEnd and a bounded planningStart/planningEnd window where movable tasks may be relocated.',
            'Use currentTime and timeZone to interpret relative phrases such as 今天/明天/今晚. If the acceptable relocation window is materially unclear, ask before producing a replanRequest.',
            'Do not include locked tasks, courses, or calendar events as movable work; the deterministic Scheduler will treat them as fixed occupancy.',
            'A replanRequest is only a request for deterministic preview. Never claim the schedule has already changed.',
            'Return one JSON object only with this exact shape:',
            '{"reply":"...","readiness":"clarify|ready","summary":"...","openQuestions":["..."],"researchQueries":[{"query":"...","reason":"...","highImpact":true,"preferOfficial":true}],"actions":[{"type":"create_task","title":"...","description":null,"priority":"medium","estimatedMinutes":30,"dueDate":null,"milestoneTitle":"基础建立"},{"type":"update_task","taskId":"exact-current-task-id","taskTitle":"...","changes":{"priority":"high","dueDate":"ISO-or-null","milestoneTitle":"强化训练"}},{"type":"update_goal","goalTitle":"当前学习目标","changes":{"name":"新的目标名称","description":"新的目标说明"}}],"replanRequests":[{"title":"临时冲突重排","blockedStart":"ISO","blockedEnd":"ISO","planningStart":"ISO","planningEnd":"ISO","reason":"..."}],"context":{"brief":[{"key":"...","value":"...","status":"confirmed|inferred|assumed"}],"constraints":[],"preferences":[],"strategy":[],"assumptions":[]}}',
            'Return researchQueries as [] when no search is needed.',
            'Return actions as [] when no concrete task write is ready for confirmation.',
            'Return replanRequests as [] when no deterministic schedule movement preview is needed.',
            'Return the complete updated context, not only a patch.',
            'Reply in the language used by the user.',
          ].join('\n'),
        },
        ...input.recentMessages.slice(-10).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: 'user',
          content: JSON.stringify({
            message: input.message,
            currentPlanningContext: input.context,
            currentTasks: input.currentTasks || [],
            planningScope: input.planningScope || null,
            goalExecution: input.goalExecution || null,
            currentTime: input.currentTime || new Date().toISOString(),
            timeZone: input.timeZone || 'UTC',
            researchAllowed: input.researchAllowed !== false,
            researchUnavailableReason: input.researchUnavailableReason || null,
            evidence: input.evidence || [],
          }),
        },
      ],
    };

    if (isQwenPlatform) {
      requestBody.enable_thinking = false;
      requestBody.response_format = { type: 'json_object' };
    }

    let response: Response | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        body: JSON.stringify(requestBody),
      });

      if (response.ok) break;
      if (attempt === 0 && RETRYABLE_PROVIDER_STATUSES.has(response.status)) {
        await sleep(retryDelayMs(response));
        continue;
      }
      throw new Error(`AI provider request failed (${response.status})`);
    }

    if (!response?.ok) throw new Error('AI provider request failed');
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI provider returned an empty response');
    return toPlanningTurn(extractJsonObject(content));
  }

}
