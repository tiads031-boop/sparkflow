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
});
