import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseTimeTrackingPreferences,
  validateTimeTrackingPatch,
} from './time-tracking-preferences';
import type { Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        tasks: { where: { status: { not: 'cancelled' } } },
        inspirations: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async getTimeTrackingPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return parseTimeTrackingPreferences(user.settings);
  }

  async updateTimeTrackingPreferences(userId: string, body: unknown) {
    const patch = validateTimeTrackingPatch(body);
    if (patch.defaultSceneId) {
      const scene = await this.prisma.sceneTemplate.findFirst({
        where: { id: patch.defaultSceneId, userId, status: 'active' },
        select: { id: true },
      });
      if (!scene) throw new BadRequestException('默认场景不存在或已归档');
    }
    // jsonb_set merges only our namespace, retaining unrelated settings during concurrent updates.
    const updated = await this.prisma.$queryRaw<
      Array<{ settings: Prisma.JsonValue }>
    >`
      UPDATE "users"
      SET "settings" = jsonb_set("settings", '{timeTracking}',
        COALESCE("settings"->'timeTracking', '{}'::jsonb) || CAST(${JSON.stringify(patch)} AS jsonb), true),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${userId}
      RETURNING "settings"
    `;
    if (!updated.length) throw new NotFoundException('用户不存在');
    return parseTimeTrackingPreferences(updated[0].settings);
  }
}
