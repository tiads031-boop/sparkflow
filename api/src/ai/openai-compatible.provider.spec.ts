import { toPlanningTurn } from './openai-compatible.provider';

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
        },
        {
          type: 'update_task',
          taskId: 'task-1',
          taskTitle: '民法论文',
          changes: {
            priority: 'high',
            estimatedMinutes: 90,
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

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0]).toEqual(expect.objectContaining({
      type: 'create_task',
      title: '拿快递',
      estimatedMinutes: 20,
    }));
    expect(result.actions[1]).toEqual(expect.objectContaining({
      type: 'update_task',
      taskId: 'task-1',
    }));
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
