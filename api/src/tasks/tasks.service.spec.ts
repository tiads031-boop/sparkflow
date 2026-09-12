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
});
