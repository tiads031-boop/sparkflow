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

describe('PlanningService course scope', () => {
  it('reuses an existing active PlanningThread only for an owned course', async () => {
    const existing = {
      id: 'thread-course',
      userId: 'user-1',
      title: '民法 课程调整',
      scopeType: 'course',
      scopeId: 'course-1',
      status: 'active',
    };
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue({ id: 'course-1', name: '民法' }),
      },
      planningThread: {
        findFirst: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
      },
    };
    const service = new PlanningService(prisma as never, {} as never, {} as never);

    await expect(service.createThread('user-1', {
      scopeType: 'course',
      scopeId: 'course-1',
    })).resolves.toEqual(existing);

    expect(prisma.course.findFirst).toHaveBeenCalledWith({
      where: { id: 'course-1', userId: 'user-1' },
      select: { id: true, name: true },
    });
    expect(prisma.planningThread.create).not.toHaveBeenCalled();
  });

  it('rejects a course scope that is not owned by the current user', async () => {
    const prisma = {
      course: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      planningThread: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new PlanningService(prisma as never, {} as never, {} as never);

    await expect(service.createThread('user-1', {
      scopeType: 'course',
      scopeId: 'other-course',
    })).rejects.toThrow('Course not found');
    expect(prisma.planningThread.create).not.toHaveBeenCalled();
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


  it('records an externally-applied course proposal without writing task or goal facts', async () => {
    const conversationUpdate = jest.fn().mockResolvedValue({});
    const tx = {
      aIConversation: {
        update: conversationUpdate,
      },
    };
    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-course',
          context: {
            actions: [{
              proposalId: 'proposal-course',
              type: 'course_change',
              courseName: '民法',
              change: {
                type: 'cancel',
                eventId: 'event-1',
              },
            }],
            appliedActionIds: [],
          },
          planningThread: {
            scopeType: 'general',
            scopeId: null,
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
      conversationId: 'conversation-course',
      proposalIds: ['proposal-course'],
    });

    expect(result.externalActionIds).toEqual(['proposal-course']);
    expect(result.createdTaskIds).toEqual([]);
    expect(result.updatedTaskIds).toEqual([]);
    expect(result.updatedGoalIds).toEqual([]);
    expect(conversationUpdate).toHaveBeenCalledWith({
      where: { id: 'conversation-course' },
      data: {
        context: expect.objectContaining({
          appliedActionIds: ['proposal-course'],
        }),
      },
    });
  });

  it('drops an AI course change when its occurrence id is not in the owned snapshot', async () => {
    const ai = {
      modelName: 'test-model',
      generatePlanningTurn: jest.fn().mockResolvedValue({
        reply: '我先生成一个调课草案。',
        readiness: 'ready',
        context: {
          brief: [],
          constraints: [],
          preferences: [],
          strategy: [],
          assumptions: [],
        },
        openQuestions: [],
        summary: '',
        researchQueries: [],
        actions: [{
          type: 'course_change',
          courseName: '民法',
          change: {
            type: 'cancel',
            eventId: 'hallucinated-event',
          },
        }],
        replanRequests: [],
      }),
    };
    const thread = {
      id: 'thread-course',
      userId: 'user-1',
      title: '调整课表',
      scopeType: 'general',
      scopeId: null,
      status: 'active',
      revision: 1,
      brief: [],
      constraints: [],
      preferences: [],
      strategy: [],
      assumptions: [],
      evidence: [],
    };
    const conversationCreate = jest.fn().mockResolvedValue({
      id: 'conversation-1',
      context: {},
    });
    const tx = {
      planningThread: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ ...thread, revision: 2 }),
      },
      aIConversation: {
        create: conversationCreate,
      },
    };
    const prisma = {
      planningThread: {
        findFirst: jest.fn().mockResolvedValue(thread),
      },
      aIConversation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      course: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'course-1',
          name: '民法',
          teacher: null,
          room: 'A101',
          location: null,
          dayOfWeek: 2,
          startTime: '09:00',
          endTime: '10:30',
          semesterId: 'semester-1',
        }]),
      },
      calendarEvent: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'event-1',
          courseId: 'course-1',
          title: '民法',
          startTime: new Date('2026-09-22T01:00:00.000Z'),
          endTime: new Date('2026-09-22T02:30:00.000Z'),
          location: 'A101',
          overrideType: null,
          overrideOriginalStart: null,
          course: { id: 'course-1', name: '民法' },
        }]),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const research = {
      isConfigured: jest.fn().mockReturnValue(false),
      providerName: 'none',
    };

    const service = new PlanningService(
      prisma as never,
      ai as never,
      research as never,
    );

    const result = await service.turn('user-1', 'thread-course', {
      message: '把明天的民法停掉',
      expectedRevision: 1,
      currentTime: '2026-09-20T02:00:00.000Z',
      timeZone: 'Asia/Shanghai',
    });

    expect(result.actions).toEqual([]);
    expect(conversationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        context: expect.objectContaining({
          actions: [],
        }),
      }),
    });
  });

});
