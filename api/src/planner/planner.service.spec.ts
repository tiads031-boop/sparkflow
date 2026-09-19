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
