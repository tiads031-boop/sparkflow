import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageIntervalInput {
  packageName: string;
  startTime: string;
  endTime: string;
}

function validPackage(value: string) {
  return (
    /^[a-zA-Z][a-zA-Z\d_]*(?:\.[a-zA-Z][a-zA-Z\d_]*)+$/.test(value) &&
    value.length <= 200
  );
}

@Injectable()
export class AppUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async settings(userId: string) {
    const [config, mappings] = await Promise.all([
      this.prisma.appUsageConfig.findUnique({ where: { userId } }),
      this.prisma.appUsageMapping.findMany({
        where: { userId },
        orderBy: { appName: 'asc' },
        include: { tag: { select: { name: true } } },
      }),
    ]);
    return { enabled: config?.enabled ?? false, mappings };
  }

  async setEnabled(userId: string, enabled: unknown) {
    if (typeof enabled !== 'boolean')
      throw new BadRequestException('enabled must be boolean');
    await this.prisma.appUsageConfig.upsert({
      where: { userId },
      create: { userId, enabled },
      update: { enabled },
    });
    return this.settings(userId);
  }

  async setMapping(
    userId: string,
    input: {
      packageName?: string;
      appName?: string;
      tagId?: string | null;
      enabled?: boolean;
    },
  ) {
    const packageName = input.packageName?.trim() ?? '';
    const appName = input.appName?.trim() ?? '';
    if (!validPackage(packageName))
      throw new BadRequestException('Invalid Android package name');
    if (!appName || appName.length > 80)
      throw new BadRequestException('Invalid app name');
    if (input.enabled !== undefined && typeof input.enabled !== 'boolean') {
      throw new BadRequestException('enabled must be boolean');
    }
    if (input.tagId) {
      const tag = await this.prisma.tag.findFirst({
        where: { id: input.tagId, userId, archived: false },
        select: { id: true },
      });
      if (!tag) throw new BadRequestException('Tag not found');
    }
    return this.prisma.appUsageMapping.upsert({
      where: { userId_packageName: { userId, packageName } },
      create: {
        userId,
        packageName,
        appName,
        tagId: input.tagId ?? null,
        enabled: input.enabled ?? true,
      },
      update: {
        appName,
        tagId: input.tagId ?? null,
        enabled: input.enabled ?? true,
      },
      include: { tag: { select: { name: true } } },
    });
  }

  async removeMapping(userId: string, packageName: string) {
    const result = await this.prisma.appUsageMapping.deleteMany({
      where: { userId, packageName },
    });
    if (!result.count) throw new NotFoundException('Mapping not found');
    return { removed: true };
  }

  async ingest(userId: string, intervals: UsageIntervalInput[]) {
    const config = await this.prisma.appUsageConfig.findUnique({
      where: { userId },
    });
    if (!config?.enabled)
      throw new ForbiddenException('Android usage recording is disabled');
    if (!Array.isArray(intervals) || intervals.length > 200) {
      throw new BadRequestException('Expected at most 200 intervals');
    }
    if (!intervals.length) return { inserted: 0 };
    const now = Date.now();
    const packages = [...new Set(intervals.map((item) => item.packageName))];
    const mappings = await this.prisma.appUsageMapping.findMany({
      where: { userId, packageName: { in: packages }, enabled: true },
      include: { tag: { select: { name: true } } },
    });
    const byPackage = new Map(mappings.map((item) => [item.packageName, item]));
    const data = intervals.map((item) => {
      if (
        !item ||
        typeof item.packageName !== 'string' ||
        typeof item.startTime !== 'string' ||
        typeof item.endTime !== 'string'
      ) {
        throw new BadRequestException('Interval is invalid');
      }
      const mapping = byPackage.get(item.packageName);
      const startTime = new Date(item.startTime);
      const endTime = new Date(item.endTime);
      const length = endTime.getTime() - startTime.getTime();
      if (
        !mapping ||
        !Number.isFinite(length) ||
        length < 10_000 ||
        length > 4 * 3_600_000 ||
        startTime.getTime() < now - 3 * 86_400_000 ||
        endTime.getTime() > now + 120_000
      ) {
        throw new BadRequestException(
          'Interval is invalid or the app is not mapped',
        );
      }
      return {
        userId,
        packageName: item.packageName,
        appName: mapping.appName,
        startTime,
        endTime,
        durationSeconds: Math.round(length / 1000),
        tagId: mapping.tagId,
        tagName: mapping.tag?.name ?? null,
      };
    });
    const result = await this.prisma.appUsageSession.createMany({
      data,
      skipDuplicates: true,
    });
    return { inserted: result.count };
  }

  async sessions(userId: string, start: string, end: string) {
    const from = new Date(start);
    const to = new Date(end);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      to <= from ||
      to.getTime() - from.getTime() > 31 * 86_400_000
    ) {
      throw new BadRequestException(
        'Expected a valid range of at most 31 days',
      );
    }
    return this.prisma.appUsageSession.findMany({
      where: { userId, startTime: { lt: to }, endTime: { gt: from } },
      orderBy: { startTime: 'desc' },
      take: 500,
    });
  }
}
