import { InspirationsService } from './inspirations.service';

function mediaMock() {
  return {
    persist: jest.fn().mockResolvedValue([]),
    removeMany: jest.fn().mockResolvedValue(undefined),
    read: jest.fn().mockResolvedValue(Buffer.from('audio')),
  };
}

function voiceMock() {
  return {
    transcribeBuffer: jest.fn().mockResolvedValue({
      text: '明天下午整理项目计划。',
      model: 'qwen3-asr-flash',
      bytes: 5,
    }),
  };
}

function aiMock() {
  return {
    summarizeText: jest.fn().mockResolvedValue('明天下午需要整理项目计划。'),
  };
}

function mediaAiMock() {
  return {
    analyzeImage: jest.fn().mockResolvedValue({
      summary: '图片包含项目排期和三个关键日期。',
      model: 'qwen3-vl-plus',
    }),
    analyzeVideo: jest.fn().mockResolvedValue({
      transcript: '先做用户访谈，再调整排期。',
      summary: '视频讨论了用户访谈与排期调整。',
      model: 'qwen3.8-omni-flash',
    }),
  };
}

function serviceWith(
  prisma: unknown,
  media = mediaMock(),
  voice = voiceMock(),
  ai = aiMock(),
  mediaAI = mediaAiMock(),
) {
  return new InspirationsService(
    prisma as never,
    media as never,
    voice as never,
    ai as never,
    mediaAI as never,
  );
}

describe('InspirationsService Phase 15 M1 + M8', () => {
  it('creates a manual record with a next-day review candidate', async () => {
    const create = jest.fn(({ data }) => data);
    const prisma = { inspiration: { create } };
    const service = serviceWith(prisma);

    const before = Date.now();
    const result = await service.create({
      userId: 'user-1',
      contentText: 'AI 自动化应该先预览再应用',
    });

    expect(result.sourceType).toBe('manual');
    expect(result.sourceUrl).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.nextReviewAt.getTime()).toBeGreaterThanOrEqual(
      before + 23 * 60 * 60 * 1000,
    );
  });

  it('creates an attachment-only inspiration and persists private attachment metadata', async () => {
    const media = mediaMock();
    media.persist.mockResolvedValue([
      {
        id: 'attachment-1',
        kind: 'image',
        mimeType: 'image/png',
        originalName: 'photo.png',
        storageKey: 'inspiration-1/attachment-1.png',
        sizeBytes: 1234,
      },
    ]);
    const create = jest.fn(({ data }) => ({
      ...data,
      attachments: data.attachments.create,
    }));
    const prisma = { inspiration: { create } };
    const service = serviceWith(prisma, media);
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
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({ id: 'inspiration-1' })
      .mockResolvedValueOnce({
        id: 'inspiration-1',
        reflections: [{ id: 'reflection-1' }],
      });
    const reflectionCreate = jest
      .fn()
      .mockResolvedValue({ id: 'reflection-1' });
    const inspirationUpdate = jest
      .fn()
      .mockResolvedValue({ id: 'inspiration-1' });
    const $transaction = jest.fn(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );
    const prisma = {
      inspiration: { findFirst, update: inspirationUpdate },
      inspirationReflection: { create: reflectionCreate },
      $transaction,
    };
    const service = serviceWith(prisma);

    await service.addReflection(
      'inspiration-1',
      'user-1',
      'Preview 也应该能撤销',
    );

    expect(reflectionCreate).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        inspirationId: 'inspiration-1',
        body: 'Preview 也应该能撤销',
      },
    });
    expect(inspirationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inspiration-1' },
        data: expect.objectContaining({
          reviewState: 'pending',
          reviewCount: { increment: 1 },
        }),
      }),
    );
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
    const service = serviceWith(prisma);

    const result = await service.createTaskFromInspiration(
      'inspiration-1',
      'user-1',
    );

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
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const media = mediaMock();
    const service = serviceWith(prisma, media);

    await service.remove('inspiration-1', 'user-1');

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['insight-1'] }, userId: 'user-1' },
    });
    expect(media.removeMany).toHaveBeenCalledWith([
      'inspiration-1/a.png',
      'inspiration-1/b.webm',
    ]);
  });

  it('explicitly transcribes an owned audio attachment and clears a stale summary', async () => {
    const media = mediaMock();
    const voice = voiceMock();
    const update = jest.fn(({ data }) => ({
      id: 'attachment-1',
      inspirationId: 'inspiration-1',
      kind: 'audio',
      mimeType: 'audio/webm',
      originalName: 'memo.webm',
      sizeBytes: 5,
      transcript: data.transcript,
      aiSummary: data.aiSummary,
      createdAt: new Date(),
    }));
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-1',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          mimeType: 'audio/webm',
          storageKey: 'inspiration-1/attachment-1.webm',
          sizeBytes: 5,
          aiSummary: '旧摘要',
        }),
        update,
      },
    };
    const service = serviceWith(prisma, media, voice);

    const result = await service.transcribeAttachment(
      'inspiration-1',
      'attachment-1',
      'user-1',
    );

    expect(media.read).toHaveBeenCalledWith('inspiration-1/attachment-1.webm');
    expect(voice.transcribeBuffer).toHaveBeenCalledWith(
      Buffer.from('audio'),
      'audio/webm',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attachment-1' },
        data: {
          transcript: '明天下午整理项目计划。',
          aiSummary: null,
        },
      }),
    );
    expect(result.transcript).toBe('明天下午整理项目计划。');
    expect(result.aiSummary).toBeNull();
  });

  it('rejects AI transcription for non-audio attachments', async () => {
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-image',
          inspirationId: 'inspiration-1',
          kind: 'image',
          mimeType: 'image/png',
          storageKey: 'inspiration-1/a.png',
          sizeBytes: 5,
        }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.transcribeAttachment(
        'inspiration-1',
        'attachment-image',
        'user-1',
      ),
    ).rejects.toThrow('当前只支持音频附件转写');
  });

  it('summarizes only a persisted transcript from an owned attachment', async () => {
    const ai = aiMock();
    const update = jest.fn(({ data }) => ({
      id: 'attachment-1',
      inspirationId: 'inspiration-1',
      kind: 'audio',
      mimeType: 'audio/webm',
      originalName: 'memo.webm',
      sizeBytes: 5,
      transcript: '讨论了下周项目计划和两个风险。',
      aiSummary: data.aiSummary,
      createdAt: new Date(),
    }));
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-1',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          mimeType: 'audio/webm',
          storageKey: 'inspiration-1/a.webm',
          sizeBytes: 5,
          transcript: '讨论了下周项目计划和两个风险。',
          inspiration: {
            title: '项目语音记录',
            contentText: '会后随手记',
          },
        }),
        update,
      },
    };
    const service = serviceWith(prisma, mediaMock(), voiceMock(), ai);

    await service.summarizeAttachment(
      'inspiration-1',
      'attachment-1',
      'user-1',
    );

    expect(ai.summarizeText).toHaveBeenCalledWith({
      text: '讨论了下周项目计划和两个风险。',
      context: '项目语音记录\n会后随手记',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { aiSummary: '明天下午需要整理项目计划。' },
      }),
    );
  });

  it('requires a transcript before generating an attachment summary', async () => {
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-1',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          transcript: null,
          inspiration: { title: null, contentText: null },
        }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.summarizeAttachment('inspiration-1', 'attachment-1', 'user-1'),
    ).rejects.toThrow('请先转写音频，再生成摘要');
  });

  it('does not analyze images after removing the image AI feature', async () => {
    const media = mediaMock();
    const mediaAI = mediaAiMock();
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-image',
          inspirationId: 'inspiration-1',
          kind: 'image',
          mimeType: 'image/png',
          storageKey: 'inspiration-1/whiteboard.png',
          sizeBytes: 5,
          inspiration: {
            title: '白板照片',
            contentText: '会议后记录',
          },
        }),
      },
    };
    const service = serviceWith(prisma, media, voiceMock(), aiMock(), mediaAI);

    await expect(service.analyzeAttachment('inspiration-1', 'attachment-image', 'user-1'))
      .rejects.toThrow('仅支持视频转写与摘要');
    expect(media.read).not.toHaveBeenCalled();
    expect(mediaAI.analyzeImage).not.toHaveBeenCalled();
  });

  it('explicitly analyzes an owned video and stores transcript plus summary', async () => {
    const media = mediaMock();
    media.read.mockResolvedValue(Buffer.from('video'));
    const mediaAI = mediaAiMock();
    const update = jest.fn(({ data }) => ({
      id: 'attachment-video',
      inspirationId: 'inspiration-1',
      kind: 'video',
      mimeType: 'video/mp4',
      originalName: 'meeting.mp4',
      sizeBytes: 5,
      transcript: data.transcript,
      aiSummary: data.aiSummary,
      createdAt: new Date(),
    }));
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-video',
          inspirationId: 'inspiration-1',
          kind: 'video',
          mimeType: 'video/mp4',
          storageKey: 'inspiration-1/meeting.mp4',
          sizeBytes: 5,
          inspiration: {
            title: '会议视频',
            contentText: null,
          },
        }),
        update,
      },
    };
    const service = serviceWith(prisma, media, voiceMock(), aiMock(), mediaAI);

    const result = await service.analyzeAttachment(
      'inspiration-1',
      'attachment-video',
      'user-1',
    );

    expect(mediaAI.analyzeVideo).toHaveBeenCalledWith(
      Buffer.from('video'),
      'video/mp4',
      '会议视频',
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'attachment-video' },
        data: {
          transcript: '先做用户访谈，再调整排期。',
          aiSummary: '视频讨论了用户访谈与排期调整。',
        },
      }),
    );
    expect(result.transcript).toBe('先做用户访谈，再调整排期。');
  });

  it('rejects generic media analysis for audio attachments', async () => {
    const prisma = {
      inspirationAttachment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'attachment-audio',
          inspirationId: 'inspiration-1',
          kind: 'audio',
          mimeType: 'audio/webm',
          storageKey: 'inspiration-1/a.webm',
          sizeBytes: 5,
          inspiration: { title: null, contentText: null },
        }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.analyzeAttachment('inspiration-1', 'attachment-audio', 'user-1'),
    ).rejects.toThrow('仅支持视频转写与摘要');
  });

  it('returns an existing capture for the same request id without persisting files again', async () => {
    const media = mediaMock();
    const existing = {
      id: 'inspiration-existing',
      userId: 'user-1',
      captureRequestId: 'capture-request-1',
      attachments: [],
    };
    const prisma = {
      inspiration: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const service = serviceWith(prisma, media);

    const result = await service.createCapture(
      'user-1',
      'same capture',
      [],
      [],
      'capture-request-1',
      'Asia/Tokyo',
    );

    expect(result).toBe(existing);
    expect(media.persist).not.toHaveBeenCalled();
    expect(prisma.inspiration.create).not.toHaveBeenCalled();
  });

  it('links a capture to an owned completed focus session', async () => {
    const prisma = {
      inspiration: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(({ data }) => ({ ...data, id: 'inspiration-focus' })),
      },
      pomodoroSession: {
        findFirst: jest.fn().mockResolvedValue({ id: 'focus-1' }),
      },
    };
    const service = serviceWith(prisma);

    const result = await service.createCapture(
      'user-1',
      '这次找到了问题根因',
      [],
      [],
      'focus-capture-1',
      'Asia/Shanghai',
      'focus-1',
    );

    expect(prisma.pomodoroSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'focus-1', userId: 'user-1', status: 'completed' },
      select: { id: true },
    });
    expect(result).toEqual(
      expect.objectContaining({
        sourceType: 'focus',
        focusSessionId: 'focus-1',
      }),
    );
  });

  it('rejects a capture linked to a foreign or unfinished focus session', async () => {
    const prisma = {
      inspiration: { findFirst: jest.fn().mockResolvedValue(null) },
      pomodoroSession: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = serviceWith(prisma);

    await expect(
      service.createCapture(
        'user-1',
        '不应该被关联',
        [],
        [],
        'focus-capture-2',
        'UTC',
        'focus-other',
      ),
    ).rejects.toThrow('已完成的专注记录不存在');
  });

  it('persists the first three eligible inspirations into a stable daily review batch', async () => {
    const batch = {
      id: 'batch-1',
      userId: 'user-1',
      localDate: '2026-09-20',
      timeZone: 'Asia/Tokyo',
    };
    const itemFindMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 'item-1',
          state: 'pending',
          ordinal: 0,
          inspiration: { id: 'inspiration-1' },
        },
        {
          id: 'item-2',
          state: 'pending',
          ordinal: 1,
          inspiration: { id: 'inspiration-2' },
        },
        {
          id: 'item-3',
          state: 'pending',
          ordinal: 2,
          inspiration: { id: 'inspiration-3' },
        },
      ]);
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      inspirationReviewBatch: {
        upsert: jest.fn().mockResolvedValue(batch),
      },
      inspirationReviewBatchItem: {
        findMany: itemFindMany,
        createMany,
      },
      inspiration: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'inspiration-1' },
            { id: 'inspiration-2' },
            { id: 'inspiration-3' },
            { id: 'inspiration-4' },
          ]),
      },
    };
    const service = serviceWith(prisma);

    const result = await service.getTodayReviewBatch('user-1', 'Asia/Tokyo');

    expect(createMany).toHaveBeenCalledTimes(1);
    expect(createMany.mock.calls[0][0].data).toHaveLength(3);
    expect(result.total).toBe(3);
    expect(result.pending).toBe(3);
  });

  it('claims a review batch item once and schedules reflection by calendar day', async () => {
    const item = {
      id: 'item-1',
      batchId: 'batch-1',
      inspirationId: 'inspiration-1',
      state: 'pending',
      processedRequestId: null,
      batch: { id: 'batch-1', userId: 'user-1', timeZone: 'Asia/Tokyo' },
    };
    const finalItem = {
      ...item,
      state: 'reflected',
      processedRequestId: 'review-request-1',
      inspiration: { id: 'inspiration-1' },
    };
    const tx = {
      inspirationReviewBatchItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      inspirationReflection: {
        create: jest.fn().mockResolvedValue({ id: 'reflection-1' }),
      },
      inspiration: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      inspirationReviewBatchItem: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(item)
          .mockResolvedValueOnce(finalItem),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = serviceWith(prisma);

    const result = await service.processReviewBatchItem('item-1', 'user-1', {
      action: 'reflection',
      requestId: 'review-request-1',
      body: '新的理解',
    });

    expect(tx.inspirationReviewBatchItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'item-1', state: 'pending' },
      data: expect.objectContaining({
        state: 'reflected',
        processedRequestId: 'review-request-1',
      }),
    });
    expect(tx.inspirationReflection.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        inspirationId: 'inspiration-1',
        body: '新的理解',
        clientRequestId: 'review-request-1',
      },
    });
    expect(tx.inspiration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inspiration-1' },
        data: expect.objectContaining({
          reviewCount: { increment: 1 },
          nextReviewAt: expect.any(Date),
        }),
      }),
    );
    expect(result).toBe(finalItem);
  });

  it('updates wall layout only when the expected version still matches', async () => {
    const existing = {
      id: 'layout-1',
      userId: 'user-1',
      inspirationId: 'inspiration-1',
      x: 10,
      y: 20,
      width: 176,
      height: 156,
      z: 1,
      color: '#f2f0e8',
      rotation: 0,
      version: 3,
    };
    const updated = { ...existing, x: 50, y: 60, version: 4 };
    const prisma = {
      inspiration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspiration-1' }),
      },
      inspirationWallLayout: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(existing)
          .mockResolvedValueOnce(updated),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = serviceWith(prisma);

    const result = await service.saveWallLayout('inspiration-1', 'user-1', {
      expectedVersion: 3,
      x: 50,
      y: 60,
      width: 176,
      height: 156,
      z: 2,
      color: '#cae393',
      rotation: 1,
    });

    expect(prisma.inspirationWallLayout.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'layout-1', userId: 'user-1', version: 3 },
        data: expect.objectContaining({
          x: 50,
          y: 60,
          version: { increment: 1 },
        }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it('rejects a stale wall layout version instead of overwriting another device', async () => {
    const prisma = {
      inspiration: {
        findFirst: jest.fn().mockResolvedValue({ id: 'inspiration-1' }),
      },
      inspirationWallLayout: {
        findUnique: jest.fn().mockResolvedValue({ id: 'layout-1', version: 5 }),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.saveWallLayout('inspiration-1', 'user-1', {
        expectedVersion: 4,
        x: 1,
        y: 2,
      }),
    ).rejects.toThrow('自由墙布局已经变化');
  });
});
