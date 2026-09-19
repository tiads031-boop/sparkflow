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
    attachments: [],
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

  it('uses explicitly generated audio transcripts as insight text without overwriting record content', async () => {
    const first = {
      ...record('inspiration-audio-1', 17),
      contentText: null,
      attachments: [{ id: 'audio-1', transcript: '我发现上午学习法律效率更高。' }],
    };
    const second = {
      ...record('inspiration-audio-2', 18),
      contentText: null,
      attachments: [{ id: 'audio-2', transcript: '上午做案例题时更容易保持专注。' }],
    };
    const prisma = {
      inspiration: { findMany: jest.fn().mockResolvedValue([first, second]) },
      insight: {
        create: jest.fn(({ data }) => Promise.resolve({ id: 'insight-audio', ...data })),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const ai = {
      modelName: 'test-model',
      generateInsights: jest.fn().mockResolvedValue([{
        title: '上午更适合高强度学习',
        body: '两条语音记录都提到了上午效率。',
        type: 'theme',
        sourceIds: ['inspiration-audio-1', 'inspiration-audio-2'],
      }]),
    };
    const service = new InsightsService(prisma as never, ai as never);

    await service.generate('user-1');

    expect(ai.generateInsights).toHaveBeenCalledWith({
      records: expect.arrayContaining([
        expect.objectContaining({
          id: 'inspiration-audio-1',
          contentText: expect.stringContaining('[语音转写 1]'),
        }),
      ]),
    });
  });

});
