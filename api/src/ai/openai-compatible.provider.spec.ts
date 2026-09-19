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
