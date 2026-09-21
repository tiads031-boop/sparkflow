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
  it('permanently deletes only the exact confirmed course and its occurrences', async () => {
    const eventDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const courseDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      calendarEvent: { deleteMany: eventDeleteMany },
      course: { deleteMany: courseDeleteMany },
      aIConversation: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-delete-course',
          context: {
            actions: [{
              proposalId: 'proposal-delete-short',
              type: 'delete_course',
              courseId: 'course-short',
              courseName: '法律职业伦理',
            }],
            appliedActionIds: [],
          },
          planningThread: { scopeType: 'general', scopeId: null },
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlanningService(prisma as never, {} as never, {} as never);

    const result = await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-delete-course',
      proposalIds: ['proposal-delete-short'],
    });

    expect(eventDeleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', courseId: 'course-short' },
    });
    expect(courseDeleteMany).toHaveBeenCalledWith({
      where: { id: 'course-short', userId: 'user-1' },
    });
    expect(result.deletedCourseIds).toEqual(['course-short']);
  });

  it('creates or reuses one AI folder and preserves exact scheduled task times', async () => {
    const taskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const folderCreate = jest.fn().mockResolvedValue({ id: 'folder-listening' });
    const folderTaskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      studyFolder: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: folderCreate,
      },
      task: {
        createMany: taskCreateMany,
        findFirst: jest.fn().mockResolvedValue({ id: 'proposal-listening-1' }),
      },
      studyFolderTask: { createMany: folderTaskCreateMany },
      aIConversation: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-listening',
          context: {
            actions: [{
              proposalId: 'proposal-listening-1',
              type: 'create_task',
              title: 'Day 1：六级听力长对话',
              estimatedMinutes: 60,
              scheduledStart: '2026-09-22T06:00:00.000Z',
              scheduledEnd: '2026-09-22T07:00:00.000Z',
              folderName: '六级听力训练',
              milestoneTitle: '长对话',
            }],
            appliedActionIds: [],
          },
          planningThread: { scopeType: 'general', scopeId: null },
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlanningService(prisma as never, {} as never, {} as never);

    const result = await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-listening',
      proposalIds: ['proposal-listening-1'],
    });

    expect(folderCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', name: '六级听力训练' }),
      select: { id: true },
    });
    expect(taskCreateMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({
        section: 'study',
        project: '长对话',
        scheduledStart: new Date('2026-09-22T06:00:00.000Z'),
        scheduledEnd: new Date('2026-09-22T07:00:00.000Z'),
      })],
      skipDuplicates: true,
    });
    expect(folderTaskCreateMany).toHaveBeenCalledWith({
      data: [{ folderId: 'folder-listening', taskId: 'proposal-listening-1' }],
      skipDuplicates: true,
    });
    expect(result.createdFolderIds).toEqual(['folder-listening']);
  });

  it('applies all 30 selected task proposals in one transaction', async () => {
    const actions = Array.from({ length: 30 }, (_, index) => ({
      proposalId: `proposal-${index + 1}`,
      type: 'create_task',
      title: `听力训练第 ${index + 1} 天`,
      dueDate: new Date(Date.UTC(2026, 8, 22 + index)).toISOString(),
    }));
    const taskCreateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      task: {
        createMany: taskCreateMany,
        findFirst: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
      },
      aIConversation: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      aIConversation: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'conversation-30',
          context: { actions, appliedActionIds: [] },
          planningThread: { scopeType: 'general', scopeId: null },
        }),
      },
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlanningService(prisma as never, {} as never, {} as never);

    const result = await service.applyActions('user-1', 'thread-1', {
      conversationId: 'conversation-30',
      proposalIds: actions.map((action) => action.proposalId),
    });

    expect(result.createdTaskIds).toHaveLength(30);
    expect(result.appliedActionIds).toHaveLength(30);
    expect(taskCreateMany).toHaveBeenCalledTimes(30);
  });

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
                scheduledStart: '2026-09-23T06:00:00.000Z',
                scheduledEnd: '2026-09-23T07:00:00.000Z',
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
      data: {
        project: '强化训练',
        scheduledStart: new Date('2026-09-23T06:00:00.000Z'),
        scheduledEnd: new Date('2026-09-23T07:00:00.000Z'),
      },
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


  it('drops a recurring course template proposal when its course id is not owned', async () => {
    const ai = {
      modelName: 'test-model',
      generatePlanningTurn: jest.fn().mockResolvedValue({
        reply: '我先生成周期课表修改草案。',
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
          type: 'course_template_change',
          courseId: 'hallucinated-course',
          courseName: '民法',
          effectiveFrom: '2026-09-21T00:00:00.000Z',
          changes: {
            dayOfWeek: 5,
            startTime: '10:00',
            endTime: '11:40',
          },
        }],
        replanRequests: [],
      }),
    };
    const thread = {
      id: 'thread-template',
      userId: 'user-1',
      title: '调整固定课表',
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
      id: 'conversation-template',
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
        findMany: jest.fn().mockResolvedValue([]),
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

    const result = await service.turn('user-1', 'thread-template', {
      message: '以后民法都改到周五上午',
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
