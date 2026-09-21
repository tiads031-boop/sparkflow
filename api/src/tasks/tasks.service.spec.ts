import { TasksService } from './tasks.service';

describe('TasksService schedule metadata', () => {
  it('persists a complete schedule payload and normalizes its dates', async () => {
    const create = jest.fn(({ data }) => data);
    const prisma = { task: { create } };
    const service = new TasksService(prisma as never);

    const result = await service.create({
      userId: 'user-1',
      title: '深度学习',
      scheduledStart: '2026-09-12T09:00:00.000Z',
      scheduledEnd: '2026-09-12T10:30:00.000Z',
      estimatedMinutes: 90,
      scheduleLocked: true,
      scheduleSource: 'manual',
      scheduleColor: '#b0a8db',
    });

    expect(result.scheduledStart).toEqual(new Date('2026-09-12T09:00:00.000Z'));
    expect(result.scheduledEnd).toEqual(new Date('2026-09-12T10:30:00.000Z'));
    expect(result.scheduleLocked).toBe(true);
    expect(result.scheduleSource).toBe('manual');
    expect(result.scheduleColor).toBe('#b0a8db');
  });

  it('persists course linkage for tasks created from course detail', async () => {
    const create = jest.fn(({ data }) => data);
    const findFirst = jest.fn().mockResolvedValue({ id: 'course-1' });
    const prisma = { task: { create }, course: { findFirst } };
    const service = new TasksService(prisma as never);

    const result = await service.create({
      userId: 'user-1',
      title: '第一次作业',
      status: 'todo',
      priority: 'medium',
      section: 'study',
      project: '法律职业伦理',
      courseId: 'course-1',
      tags: ['作业'],
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'course-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(result.courseId).toBe('course-1');
    expect(result.section).toBe('study');
    expect(result.tags).toEqual(['作业']);
  });

  it('links a new task to one owned active study folder', async () => {
    const create = jest.fn(({ data }) => data);
    const findFirst = jest.fn().mockResolvedValue({ id: 'folder-1' });
    const prisma = { task: { create }, studyFolder: { findFirst } };
    const service = new TasksService(prisma as never);

    const result = await service.create({
      userId: 'user-1',
      title: '长对话精听',
      project: '强化训练',
      tags: ['英语', '听力'],
      studyFolderId: 'folder-1',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'folder-1', userId: 'user-1', status: 'active' },
      select: { id: true },
    });
    expect(result.studyFolders).toEqual({ create: { folderId: 'folder-1' } });
  });
});


describe('TasksService Phase 15 M3 insight source', () => {
  it('creates a task linked to an insight owned by the same user', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'insight-1' });
    const create = jest.fn(({ data }) => ({ id: 'task-1', ...data }));
    const prisma = {
      insight: { findFirst },
      task: { create },
    };
    const service = new TasksService(prisma as never);

    const result = await service.create({
      userId: 'user-1',
      title: '整理可逆自动化原则',
      insightId: 'insight-1',
      estimatedMinutes: 45,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'insight-1', userId: 'user-1' },
      select: { id: true },
    });
    expect(result.insightId).toBe('insight-1');
  });

  it('rejects an insight that is not owned by the current user', async () => {
    const prisma = {
      insight: { findFirst: jest.fn().mockResolvedValue(null) },
      task: { create: jest.fn() },
    };
    const service = new TasksService(prisma as never);

    await expect(service.create({
      userId: 'user-1',
      title: '不应创建',
      insightId: 'other-user-insight',
    })).rejects.toThrow('Insight not found');

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('keeps source backlinks read-only in the generic task editor', async () => {
    const update = jest.fn(({ data }) => data);
    const prisma = { task: { update } };
    const service = new TasksService(prisma as never);

    const result = await service.update('task-1', 'user-1', {
      title: '更新标题',
      insightId: 'insight-2',
      inspirationId: 'record-2',
    });

    expect(result).toEqual({ title: '更新标题' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'task-1', userId: 'user-1' },
      data: { title: '更新标题' },
    }));
  });
});
