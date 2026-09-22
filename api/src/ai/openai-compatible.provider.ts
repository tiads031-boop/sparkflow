import { Injectable, Logger } from '@nestjs/common';
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
  PlanningSceneDraft,
  PlanningTurnInput,
  PlanningTurnResult,
} from './ai-provider';
import { CompletionTruncatedError, requestOpenAICompatibleCompletion } from './provider-request';

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

function normalizedTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.flatMap((item) => typeof item === 'string' ? [item.replace(/^#+/, '').trim().slice(0, 40)] : []).filter(Boolean))].slice(0, 12);
}

function normalizedSceneDraft(value: unknown, requireName: boolean): PlanningSceneDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const draft: PlanningSceneDraft = {};
  if (typeof candidate.name === 'string' && candidate.name.trim()) {
    draft.name = candidate.name.trim().slice(0, 60);
  } else if (requireName) return null;
  if (typeof candidate.emoji === 'string' && candidate.emoji.trim()) {
    draft.emoji = candidate.emoji.trim().slice(0, 12);
  }
  if (typeof candidate.color === 'string' && /^#[0-9a-f]{6}$/i.test(candidate.color)) {
    draft.color = candidate.color.toLowerCase();
  }
  for (const key of ['description', 'category'] as const) {
    const limit = key === 'description' ? 500 : 60;
    if (candidate[key] === null) draft[key] = null;
    else if (typeof candidate[key] === 'string') draft[key] = candidate[key].trim().slice(0, limit) || null;
  }
  if (Array.isArray(candidate.fieldSchema) && candidate.fieldSchema.length <= 20) {
    draft.fieldSchema = candidate.fieldSchema;
  }
  const lists = [
    ['triggers', new Set(['manual', 'focus', 'task_completed'])],
    ['allowedViews', new Set(['heatmap', 'trend', 'list', 'photo'])],
  ] as const;
  for (const [key, allowed] of lists) {
    const raw = candidate[key];
    if (Array.isArray(raw) && raw.length > 0 && raw.every((item) => typeof item === 'string' && allowed.has(item))) {
      draft[key] = [...new Set(raw)] as string[];
    }
  }
  return Object.keys(draft).length ? draft : null;
}

const MAX_PLANNING_ACTIONS = 60;

export function requestedCreateTaskCount(message: string): number | null {
  const normalized = message.replace(/[，。！？、]/g, ' ');
  if (/(?:已有|现有|这些|当前).{0,12}(?:任务|待办)|(?:重新安排|调整|整理).{0,12}(?:已有|现有|这些|任务|待办)/.test(normalized)) {
    return null;
  }
  const daily = normalized.match(/(\d{1,2})\s*天[^\n]{0,80}(?:每天|每日)\s*(?:一|1)\s*(?:个|项|条)?/);
  if (daily) return Math.min(Number(daily[1]), MAX_PLANNING_ACTIONS);

  const explicit = normalized.match(/(?:创建|生成|安排|新建)[^\n]{0,40}?(\d{1,2})\s*(?:个|项|条)\s*任务/);
  if (explicit) return Math.min(Number(explicit[1]), MAX_PLANNING_ACTIONS);
  return null;
}

function toPlanningActions(value: unknown): PlanningActionDraft[] {
  if (!Array.isArray(value)) return [];
  const actions: PlanningActionDraft[] = [];

  for (const item of value.slice(0, MAX_PLANNING_ACTIONS)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;

    if (candidate.type === 'create_scene') {
      const scene = normalizedSceneDraft(candidate, true);
      if (scene?.name) actions.push({ type: 'create_scene', ...scene, name: scene.name });
      continue;
    }

    if (candidate.type === 'update_scene') {
      if (typeof candidate.sceneId !== 'string' || !candidate.sceneId.trim()) continue;
      const changes = normalizedSceneDraft(candidate.changes, false);
      if (!changes) continue;
      actions.push({
        type: 'update_scene',
        sceneId: candidate.sceneId.trim().slice(0, 100),
        sceneName: typeof candidate.sceneName === 'string' ? candidate.sceneName.trim().slice(0, 60) : '',
        changes,
      });
      continue;
    }

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
      const scheduledStart = normalizedDate(candidate.scheduledStart);
      const scheduledEnd = normalizedDate(candidate.scheduledEnd);
      if (priority) action.priority = priority;
      if (estimatedMinutes !== undefined) action.estimatedMinutes = estimatedMinutes;
      if (dueDate !== undefined) action.dueDate = dueDate;
      if (scheduledStart === null || scheduledEnd === null) {
        if (scheduledStart !== scheduledEnd) continue;
        action.scheduledStart = null;
        action.scheduledEnd = null;
      } else if (scheduledStart !== undefined || scheduledEnd !== undefined) {
        if (
          typeof scheduledStart !== 'string' ||
          typeof scheduledEnd !== 'string' ||
          new Date(scheduledEnd) <= new Date(scheduledStart)
        ) continue;
        action.scheduledStart = scheduledStart;
        action.scheduledEnd = scheduledEnd;
      }
      if (typeof candidate.milestoneTitle === 'string') {
        action.milestoneTitle = candidate.milestoneTitle.trim().slice(0, 120) || null;
      } else if (candidate.milestoneTitle === null) {
        action.milestoneTitle = null;
      }
      if (typeof candidate.folderName === 'string') {
        action.folderName = candidate.folderName.trim().slice(0, 60) || null;
      } else if (candidate.folderName === null) {
        action.folderName = null;
      }
      const tags = normalizedTags(candidate.tags);
      if (tags) action.tags = tags;
      actions.push(action);
      continue;
    }

    if (candidate.type === 'course_template_change') {
      if (
        typeof candidate.courseId !== 'string' ||
        !candidate.courseId.trim() ||
        typeof candidate.courseName !== 'string' ||
        !candidate.courseName.trim() ||
        !candidate.changes ||
        typeof candidate.changes !== 'object'
      ) continue;

      const effectiveFrom = normalizedDate(candidate.effectiveFrom);
      if (typeof effectiveFrom !== 'string') continue;

      const rawChanges = candidate.changes as Record<string, unknown>;
      const changes: Extract<PlanningActionDraft, { type: 'course_template_change' }>['changes'] = {};

      if (rawChanges.dayOfWeek !== undefined) {
        if (
          typeof rawChanges.dayOfWeek !== 'number' ||
          !Number.isInteger(rawChanges.dayOfWeek) ||
          rawChanges.dayOfWeek < 1 ||
          rawChanges.dayOfWeek > 7
        ) continue;
        changes.dayOfWeek = rawChanges.dayOfWeek;
      }
      if (typeof rawChanges.startTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawChanges.startTime.trim())) {
        changes.startTime = rawChanges.startTime.trim();
      }
      if (typeof rawChanges.endTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(rawChanges.endTime.trim())) {
        changes.endTime = rawChanges.endTime.trim();
      }
      if (typeof rawChanges.room === 'string') {
        changes.room = rawChanges.room.trim().slice(0, 300) || null;
      } else if (rawChanges.room === null) {
        changes.room = null;
      }
      if (typeof rawChanges.location === 'string') {
        changes.location = rawChanges.location.trim().slice(0, 300) || null;
      } else if (rawChanges.location === null) {
        changes.location = null;
      }
      if (!Object.keys(changes).length) continue;

      actions.push({
        type: 'course_template_change',
        courseId: candidate.courseId.trim().slice(0, 100),
        courseName: candidate.courseName.trim().slice(0, 120),
        effectiveFrom,
        changes,
      });
      continue;
    }

    if (candidate.type === 'delete_course') {
      if (
        typeof candidate.courseId !== 'string' ||
        !candidate.courseId.trim() ||
        typeof candidate.courseName !== 'string' ||
        !candidate.courseName.trim()
      ) continue;
      actions.push({
        type: 'delete_course',
        courseId: candidate.courseId.trim().slice(0, 100),
        courseName: candidate.courseName.trim().slice(0, 120),
      });
      continue;
    }

    if (candidate.type === 'course_change') {
      if (
        typeof candidate.courseName !== 'string' ||
        !candidate.courseName.trim() ||
        !candidate.change ||
        typeof candidate.change !== 'object'
      ) continue;

      const rawChange = candidate.change as Record<string, unknown>;
      const changeType = rawChange.type;
      let change: Extract<PlanningActionDraft, { type: 'course_change' }>['change'] | null = null;

      if (changeType === 'cancel') {
        if (typeof rawChange.eventId !== 'string' || !rawChange.eventId.trim()) continue;
        change = {
          type: 'cancel',
          eventId: rawChange.eventId.trim().slice(0, 100),
        };
      } else if (changeType === 'swap') {
        if (
          typeof rawChange.eventId !== 'string' ||
          !rawChange.eventId.trim() ||
          typeof rawChange.otherEventId !== 'string' ||
          !rawChange.otherEventId.trim()
        ) continue;
        change = {
          type: 'swap',
          eventId: rawChange.eventId.trim().slice(0, 100),
          otherEventId: rawChange.otherEventId.trim().slice(0, 100),
        };
      } else if (changeType === 'reschedule' || changeType === 'extra') {
        const startTime = normalizedDate(rawChange.startTime);
        const endTime = normalizedDate(rawChange.endTime);
        if (typeof startTime !== 'string' || typeof endTime !== 'string') continue;
        if (new Date(endTime) <= new Date(startTime)) continue;

        const location = typeof rawChange.location === 'string'
          ? rawChange.location.trim().slice(0, 300) || null
          : rawChange.location === null
            ? null
            : undefined;

        if (changeType === 'reschedule') {
          if (typeof rawChange.eventId !== 'string' || !rawChange.eventId.trim()) continue;
          change = {
            type: 'reschedule',
            eventId: rawChange.eventId.trim().slice(0, 100),
            startTime,
            endTime,
            ...(location !== undefined ? { location } : {}),
          };
        } else {
          if (typeof rawChange.courseId !== 'string' || !rawChange.courseId.trim()) continue;
          const title = typeof rawChange.title === 'string'
            ? rawChange.title.trim().slice(0, 200) || undefined
            : undefined;
          change = {
            type: 'extra',
            courseId: rawChange.courseId.trim().slice(0, 100),
            startTime,
            endTime,
            ...(location !== undefined ? { location } : {}),
            ...(title ? { title } : {}),
          };
        }
      }

      if (!change) continue;
      actions.push({
        type: 'course_change',
        courseName: candidate.courseName.trim().slice(0, 120),
        ...(typeof candidate.otherCourseName === 'string' && candidate.otherCourseName.trim()
          ? { otherCourseName: candidate.otherCourseName.trim().slice(0, 120) }
          : {}),
        change,
      });
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
      const scheduledStart = normalizedDate(rawChanges.scheduledStart);
      const scheduledEnd = normalizedDate(rawChanges.scheduledEnd);
      if (priority) changes.priority = priority;
      if (estimatedMinutes !== undefined) changes.estimatedMinutes = estimatedMinutes;
      if (dueDate !== undefined) changes.dueDate = dueDate;
      if (scheduledStart === null || scheduledEnd === null) {
        if (scheduledStart !== scheduledEnd) continue;
        changes.scheduledStart = null;
        changes.scheduledEnd = null;
      } else if (scheduledStart !== undefined || scheduledEnd !== undefined) {
        if (
          typeof scheduledStart !== 'string' ||
          typeof scheduledEnd !== 'string' ||
          new Date(scheduledEnd) <= new Date(scheduledStart)
        ) continue;
        changes.scheduledStart = scheduledStart;
        changes.scheduledEnd = scheduledEnd;
      }
      if (typeof rawChanges.milestoneTitle === 'string') {
        changes.milestoneTitle = rawChanges.milestoneTitle.trim().slice(0, 120) || null;
      } else if (rawChanges.milestoneTitle === null) {
        changes.milestoneTitle = null;
      }
      if (typeof rawChanges.folderName === 'string') {
        const folderName = rawChanges.folderName.trim().slice(0, 60);
        if (folderName) changes.folderName = folderName;
      }
      const tags = normalizedTags(rawChanges.tags);
      if (tags) changes.tags = tags;
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
        .slice(0, 1)
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

@Injectable()
export class OpenAICompatibleProvider implements AIProvider {
  private readonly logger = new Logger(OpenAICompatibleProvider.name);

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

    const content = await requestOpenAICompatibleCompletion({
      baseUrl,
      apiKey: key,
      model: this.modelName,
      operation: 'insights',
      requestBody,
      logger: this.logger,
    });
    return toGeneratedInsights(extractJsonObject(content));
  }

  async summarizeText(input: { text: string; context?: string }): Promise<string> {
    const text = input.text.trim();
    if (!text) throw new Error('Summary text is empty');

    const key = this.apiKey();
    if (!key) throw new Error('AI provider is not configured');

    const baseUrl = this.baseUrl();
    const isQwenPlatform = /dashscope\.aliyuncs\.com/i.test(baseUrl);
    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      temperature: 0.15,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            'Summarize a user-owned personal capture without inventing facts.',
            'Use the same dominant language as the source text.',
            'Keep the summary concise and useful for later review.',
            'Preserve concrete decisions, dates, names, commitments, questions, and action ideas when present.',
            'Do not turn suggestions into confirmed facts.',
            'Return only the summary text, with no preamble.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            context: input.context?.trim().slice(0, 500) || null,
            text: text.slice(0, 12000),
          }),
        },
      ],
    };

    if (isQwenPlatform) {
      requestBody.enable_thinking = false;
    }

    const content = await requestOpenAICompatibleCompletion({
      baseUrl,
      apiKey: key,
      model: this.modelName,
      operation: 'summary',
      requestBody,
      logger: this.logger,
    });
    return content.slice(0, 4000);
  }

  async generatePlanningTurn(input: PlanningTurnInput): Promise<PlanningTurnResult> {
    const key = this.apiKey();
    if (!key) throw new Error('AI provider is not configured');

    const baseUrl = this.baseUrl();
    const isQwenPlatform = /dashscope\.aliyuncs\.com/i.test(baseUrl);
    const requestBody: Record<string, unknown> = {
      model: input.model || this.modelName,
      temperature: 0.2,
      max_tokens: 12000,
      messages: [
        {
          role: 'system',
          content: [
            'You are the planning interviewer inside SparkFlow.',
            'Your job is to understand the user deeply enough to make a reliable plan, not to rush into scheduling.',
            'Ask the highest-impact missing questions first. There is no fixed number of questions.',
            'Treat facts marked confirmed in currentPlanningContext, and direct answers already given in recentMessages, as settled. Do not ask for them again.',
            'Do not repeat, recap, enumerate, or re-confirm settled facts in reply unless the user changed them or a direct conflict must be resolved.',
            'On each clarify turn, ask exactly one question: the single unresolved answer with the greatest effect on the plan. Put only that question in openQuestions and keep reply to the minimum context needed to ask it.',
            'Do not ask optional preference questions when a safe default or explicit assumption would not materially change the plan. If no essential high-impact question remains, set readiness to ready and produce the relevant draft.',
            'When the user confirms a pending proposal, do not generate a second paraphrased proposal or ask for confirmation again. Produce the executable draft actions immediately, or briefly state that no further draft is needed.',
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
            'When an existing multi-day plan has incorrect calendar placement or missing grouping, use update_task with exact scheduledStart/scheduledEnd and folderName. Do not create duplicate replacement tasks.',
            'Do not create task actions from vague goals, brainstorms, or unresolved questions. Ask first when important task details are unclear.',
            'Task actions are only drafts for user confirmation. Never claim they are already applied.',
            'When the user asks to create a reusable tracking scene, emit create_scene. When changing an existing scene, emit update_scene and copy sceneId exactly from currentScenes.',
            'Scene actions are drafts for Scene Preview → Apply → Undo. Never claim a Scene was created or changed before confirmation.',
            'A Scene may use triggers manual, focus, or task_completed and views heatmap, trend, list, or photo. Prefer manual plus only the explicitly requested automatic triggers.',
            `A response may contain at most ${MAX_PLANNING_ACTIONS} actions. When the user explicitly requests N separate tasks within that limit, especially "N days, one task per day", emit exactly N create_task actions with distinct dates/titles; never summarize them into fewer actions while claiming N were created.`,
            'dueDate is a deadline, not a calendar placement. When the user specifies or you derive an actual day and time for doing a task, set both scheduledStart and scheduledEnd to exact ISO instants. Do not put that planned time only in dueDate.',
            'For a multi-day plan, preserve one task per intended day. Never pack later-day tasks into the first day. Use the supplied course occurrences to choose that day\'s requested free period, and keep scheduledStart/scheduledEnd on that exact date.',
            'folderName is optional. Use one shared, concise folderName only for a coherent long-term or multi-day objective such as a 30-day CET-6 listening plan. Leave it null for isolated errands, short unrelated tasks, or when grouping would add no value. Folder creation still requires confirmation with the task drafts.',
            'Use tags for horizontal classification. Prefer exact names from currentTags; do not create near-duplicate synonyms. Isolated tasks should normally use tags without folderName. Return tag names without #.',
            'Course changes are allowed only as reviewable course_change drafts. They never mean the course has already changed.',
            'For course_change, copy every courseId/eventId exactly from currentCourses/currentCourseOccurrences. Never invent or infer database ids from names.',
            'Use course_change only for one-off occurrence changes: reschedule, cancel, swap, or extra.',
            'For reschedule/cancel/swap, identify one exact currentCourseOccurrences item. If the user reference is ambiguous, ask a clarifying question instead of guessing.',
            'For swap, both eventId and otherEventId must be exact occurrence ids and must be different.',
            'For extra, courseId must be copied exactly from currentCourses and the user must have made clear which course should get the extra occurrence.',
            'Use currentTime and timeZone to resolve relative course phrases such as 明天/本周五. If the target instant is materially unclear, ask before emitting course_change.',
            'holidayCalendar is the server-supplied China statutory holiday calendar derived from the annual State Council arrangement. isOffDay=true means a statutory/rest day; isOffDay=false means a designated make-up workday.',
            'When holidayCalendar contains the relevant dates, use it instead of asking for another public-holiday search. Treat this national calendar and a school-specific teaching calendar as different facts.',
            'If the user asks to rest on statutory holidays, identify exact currentCourseOccurrences on isOffDay=true dates and emit one-off cancel course_change drafts.',
            'A national make-up workday does not reveal which weekday timetable a school follows. For isOffDay=false dates, ask for the school calendar or the explicit weekday mapping before proposing swaps, extras, or reschedules.',
            'Never silently apply holiday adjustments. Explain the affected occurrences and emit reviewable course_change drafts; execution still requires the user confirmation handled by SparkFlow.',
            'A one-off holiday cancellation, moved class, or make-up class uses course_change. A permanent recurring timetable change uses course_template_change. Do not rewrite the whole course template for a single holiday.',
            'If the user explicitly says a recurring course rule should change permanently (for example 以后都改到周五 or 从下周开始都改), use course_template_change instead of course_change.',
            'course_template_change.courseId must be copied exactly from currentCourses. Never infer an id from the course name.',
            'course_template_change.effectiveFrom is the first instant from which future ordinary recurring occurrences may be regenerated. Resolve it from explicit wording; for 从现在/以后开始 use currentTime. If the start point is ambiguous and could change whether the current week is affected, ask first.',
            'course_template_change may change only dayOfWeek, startTime, endTime, room, or location. Do not silently rewrite weeks, teacher, semester, or unrelated Course fields.',
            'A recurring template change must still go through Template Preview → Apply → Undo. Existing one-off overrides are preserved.',
            'If the user explicitly asks to permanently delete an entire recurring course/template, use delete_course. This is different from cancelling one occurrence.',
            'delete_course.courseId must be copied exactly from currentCourses. When same-name courses have different times or ids, select only the exact requested template and leave the others unchanged.',
            'Never describe a permanent course deletion only in prose. Emit a delete_course action so SparkFlow can show a destructive confirmation and execute it once.',
            'delete_course is irreversible after confirmation and removes that course template plus its generated calendar occurrences. Never claim it is deleted before confirmation.',
            'Course actions are drafts for Course Preview → Apply → Undo. Never claim a course change has already been applied.',
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
            '{"reply":"...","readiness":"clarify|ready","summary":"...","openQuestions":["..."],"researchQueries":[],"actions":[{"type":"create_task","title":"..."},{"type":"update_task","taskId":"exact-current-task-id","taskTitle":"...","changes":{"priority":"high"}},{"type":"create_scene","name":"晨间阅读","emoji":"📚","color":"#cae393","description":"...","category":"学习","fieldSchema":[],"triggers":["manual","focus"],"allowedViews":["heatmap","list"]},{"type":"update_scene","sceneId":"exact-current-scene-id","sceneName":"晨间阅读","changes":{"description":"...","allowedViews":["heatmap","trend","list"]}},{"type":"update_goal","goalTitle":"当前学习目标","changes":{"name":"新的目标名称"}},{"type":"course_change","courseName":"民法","change":{"type":"cancel","eventId":"exact-occurrence-id"}},{"type":"course_template_change","courseId":"exact-course-id","courseName":"民法","effectiveFrom":"ISO","changes":{"dayOfWeek":5}},{"type":"delete_course","courseId":"exact-course-id","courseName":"法律职业伦理"}],"replanRequests":[],"context":{"brief":[],"constraints":[],"preferences":[],"strategy":[],"assumptions":[]}}',
            'Return researchQueries as [] when no search is needed.',
            'Return actions as [] when no concrete task, Scene, learning-goal, or course draft is ready for confirmation.',
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
            currentTags: input.currentTags || [],
            currentCourses: input.currentCourses || [],
            currentCourseOccurrences: input.currentCourseOccurrences || [],
            currentScenes: input.currentScenes || [],
            holidayCalendar: input.holidayCalendar || [],
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

    const model = input.model || this.modelName;
    // Keep network retries and one format repair inside the client's 90s window.
    const deadline = Date.now() + 75_000;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('AI planning response deadline exceeded');
      const content = await requestOpenAICompatibleCompletion({
        baseUrl,
        apiKey: key,
        model,
        operation: 'planning',
        requestBody,
        logger: this.logger,
        timeoutMs: Math.min(60_000, remaining),
        deadlineAt: deadline,
        rejectTruncated: true,
        maxAttempts: attempt === 0 ? 3 : 1,
      }).catch((error: unknown) => {
        if (error instanceof CompletionTruncatedError) return '';
        throw error;
      });
      try {
        const parsed = toPlanningTurn(extractJsonObject(content));
        const requestedCount = requestedCreateTaskCount(input.message);
        const createdCount = parsed.actions.filter((action) => action.type === 'create_task').length;
        if (requestedCount !== null && createdCount !== requestedCount) {
          throw new Error(`expected_${requestedCount}_create_tasks_received_${createdCount}`);
        }
        return parsed;
      } catch (error) {
        // SyntaxError messages can contain fragments of private model output.
        const details = error instanceof SyntaxError ? 'invalid_json' : 'invalid_planning_schema';
        const diagnostic = JSON.stringify({
          event: 'ai_provider_response_parse_failed',
          model,
          operation: 'planning',
          attempt: attempt + 1,
          details,
        });
        if (attempt === 1) {
          this.logger.error(diagnostic);
          throw new Error('AI planning response validation failed after correction');
        }
        this.logger.warn(diagnostic);
        requestBody.temperature = 0;
        requestBody.messages = [
          ...(requestBody.messages as Array<{ role: string; content: string }>),
          ...(content ? [{ role: 'assistant', content: content.slice(0, 24_000) }] : []),
          {
            role: 'user',
            content: `Your previous response failed validation. Return one complete valid JSON object only, without Markdown. Include reply, readiness (clarify or ready), summary, openQuestions, researchQueries, actions, replanRequests, and context. Context must include arrays brief, constraints, preferences, strategy, and assumptions. Keep the reply concise; do not omit context or invent actions.${requestedCreateTaskCount(input.message) !== null ? ` The user requested exactly ${requestedCreateTaskCount(input.message)} separate create_task actions, so the actions array must contain exactly that many valid create_task objects.` : ''}`,
          },
        ];
      }
    }
    throw new Error('AI planning response validation failed');
  }

}
