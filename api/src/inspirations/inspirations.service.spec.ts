import { InspirationsService } from './inspirations.service';

function mediaMock() {
  return {
    persist: jest.fn().mockResolvedValue([]),
    removeMany: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(Buffer.from('voice')),
  };
}

function audioMock() {
  return {
    transcribe: jest.fn().mockResolvedValue({
      text: '这是转写后的语音内容',
      model: 'qwen3-asr-flash',
      bytes: 5,
    }),
  };
}

describe('InspirationsService Phase 15 M1 + M8', () => {
  it('creates a manual record with a next-day review candidate', async () => {
    const create = jest.fn(({ data }) => data);
    const prisma = { inspiration: { create } };
    const service = new InspirationsService(prisma as never, mediaMock() as never, audioMock() as never);

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
    const service = new InspirationsService(prisma as never, media as never, audioMock() as never);
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
    const service = new InspirationsService(prisma as never, mediaMock() as never, audioMock() as never);

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
    const service = new InspirationsService(prisma as never, mediaMock() as never, audioMock() as never);

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
    const service = new InspirationsService(prisma as never, media as never, audioMock() as never);

    await service.remove('inspiration-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['insight-1'] }, userId: 'user-1' },
    });
    expect(media.removeMany).toHaveBeenCalledWith([
      'inspiration-1/a.png',
      'inspiration-1/b.webm',
    ]);
  });

  it('transcribes an owned audio attachment once and persists the reusable transcript', async () => {
    const media = mediaMock();
    const audio = audioMock();
    const attachmentUpdate = jest.fn().mockResolvedValue({
      id: 'audio-1',
      inspirationId: 'inspiration-1',
      kind: 'audio',
      mimeType: 'audio/webm',
      originalName: 'voice.webm',
      sizeBytes: 5,
      transcript: '这是转写后的语音内容',
      createdAt: new Date(),
    });
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'audio-1',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          mimeType: 'audio/webm',
          originalName: 'voice.webm',
          storageKey: 'inspiration-1/audio-1.webm',
          sizeBytes: 5,
          transcript: null,
        }),
        update: attachmentUpdate,
      },
    };
    const service = new InspirationsService(
      prisma as never,
      media as never,
      audio as never,
    );

    const result = await service.transcribeAttachment(
      'inspiration-1',
      'audio-1',
      'user-1',
    );

    expect(media.read).toHaveBeenCalledWith('inspiration-1/audio-1.webm');
    expect(audio.transcribe).toHaveBeenCalledWith({
      buffer: Buffer.from('voice'),
      size: 5,
      mimetype: 'audio/webm',
    });
    expect(attachmentUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'audio-1' },
      data: { transcript: '这是转写后的语音内容' },
    }));
    expect(result).toEqual(expect.objectContaining({
      attachmentId: 'audio-1',
      transcript: '这是转写后的语音内容',
      reused: false,
    }));
  });

  it('reuses an existing audio transcript without calling ASR again', async () => {
    const media = mediaMock();
    const audio = audioMock();
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'audio-1',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          mimeType: 'audio/webm',
          storageKey: 'inspiration-1/audio-1.webm',
          sizeBytes: 5,
          transcript: '已有转写',
        }),
      },
    };
    const service = new InspirationsService(
      prisma as never,
      media as never,
      audio as never,
    );

    await expect(service.transcribeAttachment(
      'inspiration-1',
      'audio-1',
      'user-1',
    )).resolves.toEqual({
      attachmentId: 'audio-1',
      transcript: '已有转写',
      reused: true,
    });
    expect(media.read).not.toHaveBeenCalled();
    expect(audio.transcribe).not.toHaveBeenCalled();
  });

});
