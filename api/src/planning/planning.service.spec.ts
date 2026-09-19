import { PlanningService } from './planning.service';

describe('PlanningService goal scope', () => {
  it('reuses the active planning thread for the same owned learning goal', async () => {
    const existing = {
      id: 'thread-1',
      userId: 'user-1',
      title: '法考',
      scopeType: 'goal',
      scopeId: 'goal-1',
      status: 'active',
      revision: 3,
    };
    const prisma = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'goal-1', name: '法考' }),
      },
      planningThread: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const service = new PlanningService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createThread('user-1', {
        title: '法考',
        scopeType: 'goal',
        scopeId: 'goal-1',
      }),
    ).resolves.toEqual(existing);

    expect(prisma.studyFolder.findFirst).toHaveBeenCalledWith({
      where: { id: 'goal-1', userId: 'user-1', status: 'active' },
      select: { id: true, name: true },
    });
    expect(prisma.planningThread.create).not.toHaveBeenCalled();
  });

  it('creates confirmed goal actions as shared study tasks linked to that goal', async () => {
    const taskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const goalTaskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const conversationUpdate = jest.fn().mockResolvedValue({});

    const tx = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      },
      task: {
        createMany: taskCreateMany,
        findFirst: jest.fn().mockResolvedValue({ id: 'proposal-1' }),
      },
      studyFolderTask: {
        createMany: goalTaskCreateMany,
      },
      aIConversation: {
        update: conversationUpdate,
      },
    };

    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          context: {
            actions: [{
              proposalId: 'proposal-1',
              type: 'create_task',
              title: '完成民法第一轮',
              priority: 'medium',
              estimatedMinutes: 60,
              dueDate: null,
              milestoneTitle: '基础建立',
            }],
            appliedActionIds: [],
          },
          planningThread: {
            scopeType: 'goal',
            scopeId: 'goal-1',
          },
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };

    const service = new PlanningService(
      prisma as never,
      {} as never,
      {} as never,
    );

    const result = await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-1',
      proposalIds: ['proposal-1'],
    });

    expect(taskCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        id: 'proposal-1',
        userId: 'user-1',
        title: '完成民法第一轮',
        section: 'study',
        project: '基础建立',
        scheduleSource: 'ai',
      })],
      skipDuplicates: true,
    });
    expect(goalTaskCreateMany).toHaveBeenCalledWith({
      data: [{ folderId: 'goal-1', taskId: 'proposal-1' }],
      skipDuplicates: true,
    });
    expect(result.createdTaskIds).toEqual(['proposal-1']);
    expect(conversationUpdate).toHaveBeenCalled();
  });

  it('moves an existing goal task to a new milestone without leaving the goal', async () => {
    const taskUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const conversationUpdate = jest.fn().mockResolvedValue({});

    const tx = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'goal-1' }),
      },
      task: {
        updateMany: taskUpdateMany,
      },
      aIConversation: {
        update: conversationUpdate,
      },
    };

    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-2',
          context: {
            actions: [{
              proposalId: 'proposal-2',
              type: 'update_task',
              taskId: 'task-1',
              taskTitle: '完成民法第一轮',
              changes: {
                milestoneTitle: '强化训练',
              },
            }],
            appliedActionIds: [],
          },
          planningThread: {
            scopeType: 'goal',
            scopeId: 'goal-1',
          },
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };

    const service = new PlanningService(
      prisma as never,
      {} as never,
      {} as never,
    );

    await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-2',
      proposalIds: ['proposal-2'],
    });

    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        userId: 'user-1',
        studyFolders: { some: { folderId: 'goal-1' } },
      },
      data: { project: '强化训练' },
    });
    expect(conversationUpdate).toHaveBeenCalled();
  });

});
