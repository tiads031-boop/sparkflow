import { ConflictException } from '@nestjs/common';
import { PlannerService } from './planner.service';

describe('PlannerService undo isolation', () => {
  it('refuses to interpret a course change plan as a task schedule plan', async () => {
    const tx = {
      schedulePlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'course-plan',
          userId: 'u',
          planType: 'course',
          status: 'applied',
          beforeState: [],
          afterState: [],
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const service = new PlannerService(prisma as never);

    await expect(service.undo('u', 'course-plan')).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PlannerService natural-language task scope', () => {
  it('limits preview to selected tasks inside the current goal and avoids fixed occupancy', async () => {
    const stamp = new Date('2099-10-15T00:00:00Z');
    const taskQuery = jest.fn().mockResolvedValueOnce([{ id: 'listening', title: '听力', estimatedMinutes: 45, priority: 'medium', dueDate: null, updatedAt: stamp }]).mockResolvedValueOnce([]);
    const prisma = {
      planningThread: { findFirst: jest.fn().mockResolvedValue({ scopeType: 'goal', scopeId: 'cet6' }) },
      task: { findMany: taskQuery },
      calendarEvent: { findMany: jest.fn().mockResolvedValue([{ startTime: new Date('2099-10-15T05:00:00Z'), endTime: new Date('2099-10-15T06:00:00Z') }]) },
    };
    const result = await new PlannerService(prisma as never).preview('owner', { availabilityStart: '2099-10-15T05:00:00Z', availabilityEnd: '2099-10-15T09:00:00Z', planningThreadId: 'thread-cet6', taskIds: ['listening'] });
    expect(taskQuery.mock.calls[0][0].where).toEqual(expect.objectContaining({ userId: 'owner', id: { in: ['listening'] }, studyFolders: { some: { folderId: 'cet6' } } }));
    expect(result.proposals).toEqual([expect.objectContaining({ taskId: 'listening', start: '2099-10-15T06:00:00.000Z' })]);
  });
  it('rejects an empty explicit task scope rather than falling back to all tasks', async () => {
    const taskQuery = jest.fn();
    const service = new PlannerService({ task: { findMany: taskQuery } } as never);
    await expect(service.preview('owner', { availabilityStart: '2099-10-15T05:00:00Z', availabilityEnd: '2099-10-15T09:00:00Z', taskIds: [] })).rejects.toThrow('taskIds');
    expect(taskQuery).not.toHaveBeenCalled();
  });
});
