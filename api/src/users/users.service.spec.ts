import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService time tracking ownership', () => {
  it('rejects an archived or foreign default scene before settings write', async () => {
    const prisma = {
      sceneTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn(),
    };
    const service = new UsersService(prisma as never);
    await expect(
      service.updateTimeTrackingPreferences('user-1', {
        defaultSceneId: '01234567-89ab-cdef-0123-456789abcdef',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.sceneTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: '01234567-89ab-cdef-0123-456789abcdef',
        userId: 'user-1',
        status: 'active',
      },
      select: { id: true },
    });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
