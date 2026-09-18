import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { InsightsService } from './insights.service';

function record(id: string, day: number) {
  return {
    id,
    userId: 'user-1',
    title: null,
    description: null,
    contentText: `record ${id}`,
    tags: [],
    createdAt: new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`),
    reflections: [],
  };
}

describe('InsightsService Phase 15 M2', () => {
  it('persists only explainable insights whose source ids are all from the candidate set', async () => {
    const findMany = jest.fn().mockResolvedValue([
      record('inspiration-1', 16),
      record('inspiration-2', 17),
      record('inspiration-3', 18),
    ]);
    const create = jest.fn(({ data }) => Promise.resolve({ id: 'insight-1', ...data }));
    const prisma = {
      inspiration: { findMany },
      insight: { create },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const ai = {
      modelName: 'test-model',
      generateInsights: jest.fn().mockResolvedValue([
        {
          title: 'reversible automation',
          body: 'Several notes prefer preview and undo before mutation.',
          type: 'theme',
          sourceIds: ['inspiration-1', 'inspiration-2'],
        },
        {
          title: 'hallucinated relation',
          body: 'This must never be stored.',
          type: 'theme',
          sourceIds: ['inspiration-1', 'someone-elses-record'],
        },
      ]),
    };

    const service = new InsightsService(prisma as never, ai as never);
    const result = await service.generate('user-1');

    expect(result).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        aiModel: 'test-model',
        sources: {
          create: [
            { inspirationId: 'inspiration-1' },
            { inspirationId: 'inspiration-2' },
          ],
        },
      }),
    }));
  });

  it('requires at least two recent records before invoking AI', async () => {
    const prisma = {
      inspiration: { findMany: jest.fn().mockResolvedValue([record('inspiration-1', 18)]) },
    };
    const ai = { modelName: 'test-model', generateInsights: jest.fn() };
    const service = new InsightsService(prisma as never, ai as never);

    await expect(service.generate('user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.generateInsights).not.toHaveBeenCalled();
  });

  it('degrades provider failures to a recoverable service-unavailable response', async () => {
    const prisma = {
      inspiration: {
        findMany: jest.fn().mockResolvedValue([
          record('inspiration-1', 17),
          record('inspiration-2', 18),
        ]),
      },
    };
    const ai = {
      modelName: 'test-model',
      generateInsights: jest.fn().mockRejectedValue(new Error('provider offline')),
    };
    const service = new InsightsService(prisma as never, ai as never);

    await expect(service.generate('user-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
  it('creates a task only after confirmation and preserves the insight backlink', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'insight-1',
      userId: 'user-1',
      title: 'Review reversible automation',
      body: 'Check preview and undo entry points.',
      type: 'action',
      sources: [
        { inspirationId: 'inspiration-1' },
        { inspirationId: 'inspiration-2' },
      ],
      tasks: [],
    });
    const create = jest.fn(({ data }) => Promise.resolve({ id: 'task-1', ...data }));
    const prisma = {
      insight: { findFirst },
      task: { create },
    };
    const ai = { modelName: 'test-model', generateInsights: jest.fn() };
    const service = new InsightsService(prisma as never, ai as never);

    const task = await service.createTask('insight-1', 'user-1', {
      title: 'Audit planner undo',
      estimatedMinutes: 45,
      priority: 'high',
    });

    expect(task.insightId).toBe('insight-1');
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        insightId: 'insight-1',
        title: 'Audit planner undo',
        estimatedMinutes: 45,
        priority: 'high',
        status: 'todo',
      }),
    });
  });

  it('does not convert non-action insights into tasks', async () => {
    const prisma = {
      insight: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'insight-1',
          userId: 'user-1',
          title: 'Repeated theme',
          body: 'A theme is not automatically an action.',
          type: 'theme',
          sources: [],
          tasks: [],
        }),
      },
      task: { create: jest.fn() },
    };
    const ai = { modelName: 'test-model', generateInsights: jest.fn() };
    const service = new InsightsService(prisma as never, ai as never);

    await expect(service.createTask('insight-1', 'user-1', {}))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

});
