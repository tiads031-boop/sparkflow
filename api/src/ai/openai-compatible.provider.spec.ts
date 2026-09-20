import { OpenAICompatibleProvider, toPlanningTurn } from './openai-compatible.provider';

describe('planning response parser', () => {
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
          milestoneTitle: '基础建立',
        },
        {
          type: 'update_task',
          taskId: 'task-1',
          taskTitle: '民法论文',
          changes: {
            priority: 'high',
            estimatedMinutes: 90,
            milestoneTitle: '强化训练',
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
    }));
    expect(result.actions[1]).toEqual(expect.objectContaining({
      type: 'update_task',
      taskId: 'task-1',
      changes: expect.objectContaining({ milestoneTitle: '强化训练' }),
    }));
    expect(result.actions[2]).toEqual(expect.objectContaining({
      type: 'update_goal',
      goalTitle: '通过法考',
      changes: expect.objectContaining({ name: '2027 年通过法考' }),
    }));
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


describe('planning response recovery', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks the provider to correct an invalid structured planning response once', async () => {
    const incomplete = {
      reply: '继续',
      readiness: 'ready',
      summary: '',
      openQuestions: [],
      researchQueries: [],
      actions: [],
      replanRequests: [],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
      },
    };
    const corrected = {
      ...incomplete,
      reply: '已澄清补课日期，请确认后再应用。',
      context: {
        ...incomplete.context,
        assumptions: [],
      },
    };
    const providerResponse = (value: unknown) => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(value) } }],
      }),
    }) as Response;
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(providerResponse(incomplete))
      .mockResolvedValueOnce(providerResponse(corrected));
    const config = {
      get: jest.fn((key: string) => ({
        AI_API_KEY: 'test-key',
        AI_BASE_URL: 'https://example.invalid/v1',
        AI_MODEL: 'test-model',
      }[key])),
    };
    const provider = new OpenAICompatibleProvider(config as never);

    await expect(provider.generatePlanningTurn({
      message: '补课日期是 9 月 29 日',
      recentMessages: [],
      context: {
        brief: [],
        constraints: [],
        preferences: [],
        strategy: [],
        assumptions: [],
        revision: 1,
      },
    } as never)).resolves.toEqual(expect.objectContaining({
      reply: corrected.reply,
      readiness: 'ready',
    }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(retryBody.temperature).toBe(0);
    expect(retryBody.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('failed schema validation'),
      }),
    ]));
  });
});
