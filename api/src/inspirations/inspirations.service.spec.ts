import { InspirationsService } from './inspirations.service';

describe('InspirationsService Phase 15 M1', () => {
  it('creates a manual record with a next-day review candidate', async () => {
    const create = jest.fn(({ data }) => data);
    const prisma = { inspiration: { create } };
    const service = new InspirationsService(prisma as never);

    const before = Date.now();
    const result = await service.create({
      userId: 'user-1',
      contentText: 'AI 自动化应该先预览再应用',
    });

    expect(result.sourceType).toBe('manual');
    expect(result.sourceUrl).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.nextReviewAt.getTime()).toBeGreaterThanOrEqual(before + 23 * 60 * 60 * 1000);
  });

  it('stores reflections separately and schedules the next review three days later', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'inspiration-1' });
    const reflectionCreate = jest.fn().mockResolvedValue({ id: 'reflection-1' });
    const inspirationUpdate = jest.fn().mockResolvedValue({ id: 'inspiration-1' });
    const findOne = jest.fn().mockResolvedValue({ id: 'inspiration-1', reflections: [{ id: 'reflection-1' }] });
    const $transaction = jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
    const prisma = {
      inspiration: { findFirst, update: inspirationUpdate },
      inspirationReflection: { create: reflectionCreate },
      $transaction,
    };
    const service = new InspirationsService(prisma as never);
    jest.spyOn(service, 'findOne').mockImplementation(findOne as never);

    await service.addReflection('inspiration-1', 'user-1', 'Preview 也应该能撤销');

    expect(reflectionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        inspirationId: 'inspiration-1',
        body: 'Preview 也应该能撤销',
      },
    });
    expect(inspirationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'inspiration-1' },
      data: expect.objectContaining({
        reviewState: 'pending',
        reviewCount: { increment: 1 },
      }),
    }));
  });

  it('creates at most one linked task and preserves the inspiration backlink', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'inspiration-1',
      userId: 'user-1',
      title: null,
      description: null,
      contentText: '整理 SparkFlow 的可逆自动化原则',
      tags: ['SparkFlow'],
      task: null,
    });
    const create = jest.fn(({ data }) => ({ id: 'task-1', ...data }));
    const prisma = {
      inspiration: { findFirst },
      task: { create },
    };
    const service = new InspirationsService(prisma as never);

    const result = await service.createTaskFromInspiration('inspiration-1', 'user-1');

    expect(result.inspirationId).toBe('inspiration-1');
    expect(result.title).toBe('整理 SparkFlow 的可逆自动化原则');
    expect(result.tags).toEqual(['SparkFlow']);
  });
});
