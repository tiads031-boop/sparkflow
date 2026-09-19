import { buildGoalExecutionSnapshot, PlanningService } from './planning.service';

describe('goal execution snapshot', () => {
  it('derives progress, overdue work, focus and milestone stats from existing facts', () => {
    const now = new Date('2026-09-20T12:00:00.000Z');
    const snapshot = buildGoalExecutionSnapshot([
      {
        title: '基础阅读',
        status: 'done',
        dueDate: new Date('2026-09-18T12:00:00.000Z'),
        completedAt: new Date('2026-09-19T10:00:00.000Z'),
        project: '基础建立',
      },
      {
        title: '错题整理',
        status: 'todo',
        dueDate: new Date('2026-09-19T12:00:00.000Z'),
        completedAt: null,
        project: '强化训练',
      },
      {
        title: '本周模拟',
        status: 'in_progress',
        dueDate: new Date('2026-09-22T12:00:00.000Z'),
        completedAt: null,
        project: '强化训练',
      },
    ], 85, now);

    expect(snapshot).toEqual(expect.objectContaining({
      totalTasks: 3,
      completedTasks: 1,
      activeTasks: 2,
      overdueTasks: 1,
      completedLast7Days: 1,
      focusMinutesLast7Days: 85,
      recentlyCompletedTitles: ['基础阅读'],
    }));
    expect(snapshot.milestones).toEqual(expect.arrayContaining([
      expect.objectContaining({
        title: '基础建立',
        totalTasks: 1,
        completedTasks: 1,
      }),
      expect.objectContaining({
        title: '强化训练',
        totalTasks: 2,
        overdueTasks: 1,
      }),
    ]));
  });
});

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

  it('applies an explicit goal change only to the current active goal and syncs the thread title', async () => {
    const goalUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const threadUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const conversationUpdate = jest.fn().mockResolvedValue({});

    const tx = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'goal-1' }),
        updateMany: goalUpdateMany,
      },
      planningThread: {
        updateMany: threadUpdateMany,
      },
      task: {
        updateMany: jest.fn(),
      },
      aIConversation: {
        update: conversationUpdate,
      },
    };

    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-goal',
          context: {
            actions: [{
              proposalId: 'proposal-goal',
              type: 'update_goal',
              goalTitle: '通过法考',
              changes: {
                name: '2027 年通过法考',
                description: '调整为更长周期准备。',
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

    const result = await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-goal',
      proposalIds: ['proposal-goal'],
    });

    expect(goalUpdateMany).toHaveBeenCalledWith({
      where: { id: 'goal-1', userId: 'user-1', status: 'active' },
      data: {
        name: '2027 年通过法考',
        description: '调整为更长周期准备。',
      },
    });
    expect(threadUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'thread-1',
        userId: 'user-1',
        scopeType: 'goal',
        scopeId: 'goal-1',
      },
      data: { title: '2027 年通过法考' },
    });
    expect(result.updatedGoalIds).toEqual(['goal-1']);
    expect(conversationUpdate).toHaveBeenCalled();
  });

});
