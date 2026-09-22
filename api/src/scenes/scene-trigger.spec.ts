import { attachDefaultFocusScene } from './scene-trigger';

const focus = {
  id: 'session-1',
  userId: 'user-1',
  taskId: null,
  startedAt: new Date('2026-09-22T10:00:00Z'),
  effectiveDurationSeconds: 1200,
};

describe('Default Scene Focus association', () => {
  it('creates one idempotent link only for an active owned Focus trigger', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { timeTracking: { defaultSceneId: 'scene-1' } },
        }),
      },
      sceneTemplate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'scene-1' }),
      },
      sceneEntry: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    await attachDefaultFocusScene(tx as never, focus);
    expect(tx.sceneTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'scene-1',
        userId: 'user-1',
        status: 'active',
        triggers: { has: 'focus' },
      },
      select: { id: true },
    });
    expect(tx.sceneEntry.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            pomodoroSessionId: 'session-1',
            clientRequestId: 'auto:focus:session-1',
          }),
        ],
        skipDuplicates: true,
      }),
    );
  });

  it('does not create an entry for another Scene or an empty Focus', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          settings: { timeTracking: { defaultSceneId: 'scene-1' } },
        }),
      },
      sceneTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      sceneEntry: { createMany: jest.fn() },
    };
    await attachDefaultFocusScene(tx as never, focus);
    await attachDefaultFocusScene(tx as never, {
      ...focus,
      effectiveDurationSeconds: 0,
    });
    expect(tx.sceneEntry.createMany).not.toHaveBeenCalled();
    expect(tx.user.findUnique).toHaveBeenCalledTimes(1);
  });
});
