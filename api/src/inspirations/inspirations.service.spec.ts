import { InspirationsService } from './inspirations.service';

function mediaMock() {
  return {
    persist: jest.fn().mockResolvedValue([]),
    removeMany: jest.fn().mockResolvedValue(undefined),
  };
}

describe('InspirationsService Phase 15 M1 + M8', () => {
  it('creates a manual record with a next-day review candidate', async () => {
    const create = jest.fn(({ data }) => data);
    const prisma = { inspiration: { create } };
    const service = new InspirationsService(prisma as never, mediaMock() as never);

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

  it('creates an attachment-only inspiration and persists private attachment metadata', async () => {
    const media = mediaMock();
    media.persist.mockResolvedValue([{
      id: 'attachment-1',
      kind: 'image',
      mimeType: 'image/png',
      originalName: 'photo.png',
      storageKey: 'inspiration-1/attachment-1.png',
      sizeBytes: 1234,
    }]);
    const create = jest.fn(({ data }) => ({
      ...data,
      attachments: data.attachments.create,
    }));
    const prisma = { inspiration: { create } };
    const service = new InspirationsService(prisma as never, media as never);
    const file = {
      buffer: Buffer.from('png'),
      size: 3,
      mimetype: 'image/png',
      originalname: 'photo.png',
    } as Express.Multer.File;

    const result = await service.createCapture('user-1', '', [file], []);

    expect(media.persist).toHaveBeenCalledWith(expect.any(String), [file]);
    expect(result.contentText).toBeNull();
    expect(result.attachments).toEqual([
      expect.objectContaining({
        id: 'attachment-1',
        kind: 'image',
        storageKey: 'inspiration-1/attachment-1.png',
      }),
    ]);
  });

  it('stores reflections separately and schedules the next review three days later', async () => {
    const findFirst = jest.fn()
      .mockResolvedValueOnce({ id: 'inspiration-1' })
      .mockResolvedValueOnce({ id: 'inspiration-1', reflections: [{ id: 'reflection-1' }] });
    const reflectionCreate = jest.fn().mockResolvedValue({ id: 'reflection-1' });
    const inspirationUpdate = jest.fn().mockResolvedValue({ id: 'inspiration-1' });
    const $transaction = jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops));
    const prisma = {
      inspiration: { findFirst, update: inspirationUpdate },
      inspirationReflection: { create: reflectionCreate },
      $transaction,
    };
    const service = new InspirationsService(prisma as never, mediaMock() as never);

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
    const service = new InspirationsService(prisma as never, mediaMock() as never);

    const result = await service.createTaskFromInspiration('inspiration-1', 'user-1');

    expect(result.inspirationId).toBe('inspiration-1');
    expect(result.title).toBe('整理 SparkFlow 的可逆自动化原则');
    expect(result.tags).toEqual(['SparkFlow']);
  });

  it('removes private files after deleting the inspiration and dependent insight links', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: 'inspiration-1',
      attachments: [
        { storageKey: 'inspiration-1/a.png' },
        { storageKey: 'inspiration-1/b.webm' },
      ],
    });
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      inspiration: {
        delete: jest.fn().mockResolvedValue({ id: 'inspiration-1' }),
      },
      insightInspiration: {
        findMany: jest.fn().mockResolvedValue([{ insightId: 'insight-1' }]),
        count: jest.fn().mockResolvedValue(1),
      },
      insight: { deleteMany },
    };
    const prisma = {
      inspiration: { findFirst },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const media = mediaMock();
    const service = new InspirationsService(prisma as never, media as never);

    await service.remove('inspiration-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['insight-1'] }, userId: 'user-1' },
    });
    expect(media.removeMany).toHaveBeenCalledWith([
      'inspiration-1/a.png',
      'inspiration-1/b.webm',
    ]);
  });
});
