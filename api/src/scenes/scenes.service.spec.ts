import { BadRequestException, ConflictException } from '@nestjs/common';
import { ScenesService } from './scenes.service';

const scene = {
  id: 'scene-1',
  userId: 'alice',
  status: 'active',
  fieldSchema: [],
};
const input = {
  sourceType: 'manual' as const,
  occurredAt: '2026-09-20T10:00:00Z',
  pomodoroSessionId: 'session-1',
  clientRequestId: 'request-1',
};

describe('ScenesService owner and idempotency', () => {
  const prisma = {
    sceneTemplate: { findFirst: jest.fn() },
    sceneEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    pomodoroSession: { findFirst: jest.fn() },
    task: { findFirst: jest.fn() },
    inspiration: { findFirst: jest.fn() },
  };
  const service = new ScenesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sceneTemplate.findFirst.mockResolvedValue(scene);
    prisma.sceneEntry.findFirst.mockResolvedValue(null);
    prisma.pomodoroSession.findFirst.mockResolvedValue({
      status: 'completed',
      endedAt: new Date(),
      entrySource: 'manual',
    });
    prisma.sceneEntry.create.mockResolvedValue({ id: 'entry-1' });
  });

  it('checks ownership of the linked time fact before writing', async () => {
    await service.createEntry('alice', scene.id, input);
    expect(prisma.pomodoroSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'alice' },
    });
    expect(prisma.sceneEntry.create).toHaveBeenCalledTimes(1);
    prisma.pomodoroSession.findFirst.mockResolvedValue(null);
    await expect(service.createEntry('alice', scene.id, input)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.sceneEntry.create).toHaveBeenCalledTimes(1);
  });

  it('returns an existing request only in its original scene', async () => {
    prisma.sceneEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      sceneId: scene.id,
    });
    expect(await service.createEntry('alice', scene.id, input)).toEqual({
      id: 'entry-1',
      sceneId: scene.id,
    });
    prisma.sceneEntry.findFirst.mockResolvedValue({
      id: 'entry-2',
      sceneId: 'different',
    });
    await expect(service.createEntry('alice', scene.id, input)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.sceneEntry.create).not.toHaveBeenCalled();
  });

  it('scopes deletion to scene and owner', async () => {
    prisma.sceneEntry.deleteMany.mockResolvedValue({ count: 1 });
    await service.deleteEntry('alice', scene.id, 'entry-1');
    expect(prisma.sceneEntry.deleteMany).toHaveBeenCalledWith({
      where: { id: 'entry-1', userId: 'alice', sceneId: scene.id },
    });
  });
});
