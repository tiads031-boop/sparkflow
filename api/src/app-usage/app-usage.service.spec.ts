import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AppUsageService } from './app-usage.service';

describe('AppUsageService', () => {
  const now = Date.now();
  const interval = {
    packageName: 'com.example.reader',
    startTime: new Date(now - 120_000).toISOString(),
    endTime: new Date(now - 60_000).toISOString(),
  };

  it('refuses uploads until the account explicitly enables recording', async () => {
    const prisma = {
      appUsageConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      appUsageSession: { createMany: jest.fn() },
    };
    await expect(
      new AppUsageService(prisma as never).ingest('owner', [interval]),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.appUsageSession.createMany).not.toHaveBeenCalled();
  });

  it('accepts only mapped apps and uses idempotent user-scoped writes', async () => {
    const prisma = {
      appUsageConfig: {
        findUnique: jest.fn().mockResolvedValue({ enabled: true }),
      },
      appUsageMapping: {
        findMany: jest.fn().mockResolvedValue([
          {
            packageName: 'com.example.reader',
            appName: '阅读',
            tagId: 'tag-1',
            tag: { name: '学习' },
          },
        ]),
      },
      appUsageSession: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new AppUsageService(prisma as never);
    await expect(service.ingest('owner', [null as never])).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appUsageMapping.findMany).not.toHaveBeenCalled();
    expect(await service.ingest('owner', [interval])).toEqual({ inserted: 1 });
    expect(prisma.appUsageMapping.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'owner',
        enabled: true,
        packageName: { in: ['com.example.reader'] },
      },
      include: { tag: { select: { name: true } } },
    });
    expect(prisma.appUsageSession.createMany).toHaveBeenCalledWith({
      skipDuplicates: true,
      data: [
        {
          userId: 'owner',
          packageName: 'com.example.reader',
          appName: '阅读',
          startTime: new Date(interval.startTime),
          endTime: new Date(interval.endTime),
          durationSeconds: 60,
          tagId: 'tag-1',
          tagName: '学习',
        },
      ],
    });
    await expect(
      service.ingest('owner', [{ ...interval, packageName: 'com.other.app' }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
