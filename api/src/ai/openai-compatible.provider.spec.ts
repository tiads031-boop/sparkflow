import { Logger } from '@nestjs/common';
import {
  OpenAICompatibleProvider,
  requestedCreateTaskCount,
  toPlanningTurn,
} from './openai-compatible.provider';
import type { PlanningTurnInput } from './ai-provider';

describe('planning response recovery', () => {
  const complete = {
    reply: '请确认调课草稿', readiness: 'ready', summary: '', openQuestions: [],
    researchQueries: [], actions: [], replanRequests: [],
    context: { brief: [], constraints: [], preferences: [], strategy: [], assumptions: [] },
  };
  const input = {
    model: 'deepseek-v4-flash', message: '确认调课', recentMessages: [],
    context: { ...complete.context, revision: 7 },
  } as PlanningTurnInput;
  function provider() {
    const values: Record<string, string> = {
      AI_API_KEY: 'secret', AI_BASE_URL: 'https://example.invalid/v1', AI_MODEL: 'default-model',
    };
    return new OpenAICompatibleProvider({ get: (key: string) => values[key] } as never);
  }
  function response(content: unknown) {
    return new Response(JSON.stringify({ choices: [{ message: {
      content: typeof content === 'string' ? content : JSON.stringify(content),
    } }] }), { status: 200 });
  }
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['truncated JSON', '{"reply":"private-planning-content'],
    ['missing context section', { ...complete, context: { brief: [] } }],
    ['invalid readiness', { ...complete, readiness: 'done' }],
  ])('corrects %s once while retaining the selected model and current context', async (_label, invalid) => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(invalid)).mockResolvedValueOnce(response(complete));
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(provider().generatePlanningTurn(input)).resolves.toMatchObject(complete);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    const repair = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(first.model).toBe('deepseek-v4-flash');
    expect(first.max_tokens).toBe(12000);
    expect(repair.model).toBe(first.model);
    expect(repair.temperature).toBe(0);
    expect(repair.messages.slice(0, first.messages.length)).toEqual(first.messages);
    expect(repair.messages.at(-1).content).toContain('failed validation');
    expect(JSON.stringify(warn.mock.calls)).toContain('deepseek-v4-flash');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('private-planning-content');
  });

  it('rejects two invalid responses without inventing a successful plan', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => response('private invalid output'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(provider().generatePlanningTurn(input)).rejects.toThrow('validation failed after correction');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error.mock.calls)).not.toContain('private invalid output');
  });

  it('does not accept a length-limited completion even when its JSON parses', async () => {
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{
        finish_reason: 'length', message: { content: JSON.stringify(complete) },
      }] }), { status: 200 }))
      .mockResolvedValueOnce(response(complete));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(provider().generatePlanningTurn(input)).resolves.toMatchObject(complete);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not repair a provider authentication rejection', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('', { status: 401 }));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(provider().generatePlanningTurn(input)).rejects.toThrow('(401)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid first response without additional requests', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response(complete));
    await expect(provider().generatePlanningTurn(input)).resolves.toMatchObject(complete);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('repairs a daily plan whose declared duration has too few task actions', async () => {
    const dailyInput = {
      ...input,
      message: '30天六级听力训练，每天一个具体练习',
    };
    const short = {
      ...complete,
      reply: '已生成 30 个任务。',
      actions: Array.from({ length: 8 }, (_, index) => ({
        type: 'create_task', title: `练习 ${index + 1}`,
      })),
    };
    const full = {
      ...complete,
      reply: '已生成 30 个任务草案。',
      actions: Array.from({ length: 30 }, (_, index) => ({
        type: 'create_task', title: `练习 ${index + 1}`,
      })),
    };
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(response(short))
      .mockResolvedValueOnce(response(full));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    await expect(provider().generatePlanningTurn(dailyInput)).resolves.toMatchObject({
      actions: expect.arrayContaining([expect.objectContaining({ title: '练习 30' })]),
    });
    const repair = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repair.messages.at(-1).content).toContain('exactly 30 separate create_task actions');
  });
});

describe('planning response parser', () => {
  it('preserves a 30-day daily task plan instead of truncating it to 8 actions', () => {
    const actions = Array.from({ length: 30 }, (_, index) => ({
      type: 'create_task',
      title: `听力训练第 ${index + 1} 天`,
      dueDate: new Date(Date.UTC(2026, 8, 22 + index)).toISOString(),
    }));
    const result = toPlanningTurn({
      reply: '已生成 30 项任务草案。',
      readiness: 'ready',
      summary: '30 天听力训练。',
      openQuestions: [],
      researchQueries: [],
      actions,
      replanRequests: [],
      context: {
        brief: [], constraints: [], preferences: [], strategy: [], assumptions: [],
      },
    });

    expect(result.actions).toHaveLength(30);
    expect(result.actions[29]).toEqual(expect.objectContaining({ title: '听力训练第 30 天' }));
  });

  it('recognizes explicit daily and numbered task counts', () => {
    expect(requestedCreateTaskCount('30天六级听力训练，每天一个具体练习')).toBe(30);
    expect(requestedCreateTaskCount('请创建 12 个任务')).toBe(12);
    expect(requestedCreateTaskCount('重新整理现有30天任务，每天一个')).toBeNull();
    expect(requestedCreateTaskCount('帮我规划六级听力')).toBeNull();
  });

  it('accepts complete structured planning context and trims unsafe excess', () => {
    const result = toPlanningTurn({
      reply: '我还需要确认你的截止时间。',
      readiness: 'clarify',
      summary: '准备法考，时间预算仍待确认。',
      openQuestions: ['考试目标是哪一次？'],
      context: {
        brief: [{ key: 'goal', value: '通过法考', status: 'confirmed' }],
        constraints: [{ key: 'work', value: '周二晚上不可用', status: 'confirmed' }],
        preferences: [{ key: 'session', value: '工作日短学习', status: 'inferred' }],
        strategy: [{ key: 'order', value: '先补弱项', status: 'assumed' }],
        assumptions: [{ key: 'weekend', value: '周日可学习两小时', status: 'assumed' }],
      },
    });

    expect(result.readiness).toBe('clarify');
    expect(result.context.brief[0]).toEqual({
      key: 'goal',
      value: '通过法考',
      status: 'confirmed',
    });
    expect(result.openQuestions).toEqual(['考试目标是哪一次？']);
  });

  it('parses bounded research requests for external facts', () => {
    const result = toPlanningTurn({
      reply: '我先核实本次考试的官方时间。',
      readiness: 'clarify',
      summary: '考试时间需要外部核验。',
      openQuestions: [],
      researchQueries: [
        {
          query: '2026 exam official schedule',
          reason: 'The exam date changes the whole timeline',
          highImpact: true,
          preferOfficial: true,
        },
      ],
      context: {
        brief: [{ key: 'goal', value: '通过考试', status: 'confirmed' }],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.researchQueries).toEqual([
      expect.objectContaining({
        query: '2026 exam official schedule',
        highImpact: true,
        preferOfficial: true,
      }),
    ]);
  });

  it('parses reviewable create and update task actions', () => {
    const result = toPlanningTurn({
      reply: '我整理成两项操作，确认后再写入。',
      readiness: 'ready',
      summary: '准备创建一个任务并更新一个现有任务。',
      openQuestions: [],
      researchQueries: [],
      actions: [
        {
          type: 'create_task',
          title: '拿快递',
          priority: 'medium',
          estimatedMinutes: 20,
          dueDate: '2026-09-20T10:00:00.000Z',
          scheduledStart: '2026-09-20T09:00:00.000Z',
          scheduledEnd: '2026-09-20T09:20:00.000Z',
          milestoneTitle: '基础建立',
          folderName: '生活事项',
        },
        {
          type: 'update_task',
          taskId: 'task-1',
          taskTitle: '民法论文',
          changes: {
            priority: 'high',
            estimatedMinutes: 90,
            milestoneTitle: '强化训练',
            scheduledStart: '2026-09-21T06:00:00.000Z',
            scheduledEnd: '2026-09-21T07:30:00.000Z',
            folderName: '法考训练',
          },
        },
        {
          type: 'update_goal',
          goalTitle: '通过法考',
          changes: {
            name: '2027 年通过法考',
            description: '主攻客观题与主观题两阶段。',
          },
        },
      ],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.actions).toHaveLength(3);
    expect(result.actions[0]).toEqual(expect.objectContaining({
      type: 'create_task',
      title: '拿快递',
      estimatedMinutes: 20,
      milestoneTitle: '基础建立',
      scheduledStart: '2026-09-20T09:00:00.000Z',
      scheduledEnd: '2026-09-20T09:20:00.000Z',
      folderName: '生活事项',
    }));
    expect(result.actions[1]).toEqual(expect.objectContaining({
      type: 'update_task',
      taskId: 'task-1',
      changes: expect.objectContaining({
        milestoneTitle: '强化训练',
        scheduledStart: '2026-09-21T06:00:00.000Z',
        scheduledEnd: '2026-09-21T07:30:00.000Z',
        folderName: '法考训练',
      }),
    }));
    expect(result.actions[2]).toEqual(expect.objectContaining({
      type: 'update_goal',
      goalTitle: '通过法考',
      changes: expect.objectContaining({ name: '2027 年通过法考' }),
    }));
  });

  it('drops a create-task draft with only half of a scheduled interval', () => {
    const result = toPlanningTurn({
      reply: '安排草案。', readiness: 'ready', summary: '', openQuestions: [], researchQueries: [],
      actions: [{ type: 'create_task', title: '不完整安排', scheduledStart: '2026-09-22T06:00:00.000Z' }],
      replanRequests: [],
      context: { brief: [], constraints: [], preferences: [], strategy: [], assumptions: [] },
    });
    expect(result.actions).toEqual([]);
  });

  it('parses a reviewable one-off course change draft', () => {
    const result = toPlanningTurn({
      reply: '我定位到了明天这节民法，先生成调课草案。',
      readiness: 'ready',
      summary: '将一个具体课程实例移动到新时间。',
      openQuestions: [],
      researchQueries: [],
      actions: [
        {
          type: 'course_change',
          courseName: '民法',
          change: {
            type: 'reschedule',
            eventId: 'event-1',
            startTime: '2026-09-25T01:00:00.000Z',
            endTime: '2026-09-25T02:30:00.000Z',
            location: 'B202',
          },
        },
      ],
      replanRequests: [],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.actions).toEqual([
      {
        type: 'course_change',
        courseName: '民法',
        change: {
          type: 'reschedule',
          eventId: 'event-1',
          startTime: '2026-09-25T01:00:00.000Z',
          endTime: '2026-09-25T02:30:00.000Z',
          location: 'B202',
        },
      },
    ]);
  });

  it('parses an explicit recurring course template change draft', () => {
    const result = toPlanningTurn({
      reply: '你明确说从下周开始以后都改到周五，我先生成周期课表修改草案。',
      readiness: 'ready',
      summary: '修改民法未来周期模板。',
      openQuestions: [],
      researchQueries: [],
      actions: [
        {
          type: 'course_template_change',
          courseId: 'course-1',
          courseName: '民法',
          effectiveFrom: '2026-09-21T00:00:00.000Z',
          changes: {
            dayOfWeek: 5,
            startTime: '10:00',
            endTime: '11:40',
            room: 'B202',
          },
        },
      ],
      replanRequests: [],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.actions).toEqual([
      {
        type: 'course_template_change',
        courseId: 'course-1',
        courseName: '民法',
        effectiveFrom: '2026-09-21T00:00:00.000Z',
        changes: {
          dayOfWeek: 5,
          startTime: '10:00',
          endTime: '11:40',
          room: 'B202',
        },
      },
    ]);
  });

  it('parses bounded temporary-conflict replan requests', () => {
    const result = toPlanningTurn({
      reply: '下午临时有事，我先给你生成一个重排预览。',
      readiness: 'ready',
      summary: '需要移动冲突时段内的可移动任务。',
      openQuestions: [],
      researchQueries: [],
      actions: [],
      replanRequests: [
        {
          title: '下午临时冲突',
          blockedStart: '2026-09-20T06:00:00.000Z',
          blockedEnd: '2026-09-20T08:00:00.000Z',
          planningStart: '2026-09-20T00:00:00.000Z',
          planningEnd: '2026-09-21T14:00:00.000Z',
          reason: '用户明确表示该时段无法执行原计划。',
        },
      ],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.replanRequests).toEqual([
      expect.objectContaining({
        title: '下午临时冲突',
        blockedStart: '2026-09-20T06:00:00.000Z',
        blockedEnd: '2026-09-20T08:00:00.000Z',
      }),
    ]);
  });

  it('rejects an incomplete response instead of wiping an existing context section', () => {
    expect(() => toPlanningTurn({
      reply: '继续',
      readiness: 'ready',
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
      },
    })).toThrow('assumptions');
  });

  it('drops facts with an invalid confirmation status', () => {
    const result = toPlanningTurn({
      reply: '收到',
      readiness: 'ready',
      context: {
        brief: [{ key: 'goal', value: '通过考试', status: 'certain' }],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
      },
    });

    expect(result.context.brief).toEqual([]);
  });
});
