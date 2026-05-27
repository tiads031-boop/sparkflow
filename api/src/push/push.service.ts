import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@sparkflow.local';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.logger.log('VAPID keys configured');
    } else {
      this.logger.warn('VAPID keys not configured — push notifications disabled');
    }
  }

  getVapidPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  async subscribe(userId: string, subscription: webpush.PushSubscription) {
    const existing = await this.prisma.pushSubscription.findFirst({
      where: { userId, endpoint: subscription.endpoint },
    });

    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
    }

    return this.prisma.pushSubscription.create({
      data: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  async unsubscribe(userId: string, endpoint: string) {
    const sub = await this.prisma.pushSubscription.findFirst({
      where: { userId, endpoint },
    });
    if (!sub) return { deleted: false };

    await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
    return { deleted: true };
  }

  async getUserSubscriptionCount(userId: string): Promise<number> {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  /**
   * 每分钟扫描即将到期的任务并推送通知
   */
  @Cron('*/1 * * * *')
  async notifyDueTasks() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey) return; // VAPID not configured

    const now = new Date();
    const window = new Date(now.getTime() + 30 * 60 * 1000); // 未来30分钟

    const dueTasks = await this.prisma.task.findMany({
      where: {
        dueDate: { lte: window, gte: now },
        status: { notIn: ['done', 'cancelled'] },
      },
      select: { title: true, dueDate: true },
      orderBy: { dueDate: 'asc' },
      take: 5,
    });

    if (dueTasks.length === 0) return;

    const subs = await this.prisma.pushSubscription.findMany();
    if (subs.length === 0) return;

    const taskTitles = dueTasks.map((t) => {
      const time = t.dueDate
        ? new Date(t.dueDate).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        : '';
      return time ? `· ${t.title}（${time}）` : `· ${t.title}`;
    });

    const payload = JSON.stringify({
      title: `⏰ ${dueTasks.length} 个任务即将到期`,
      body: taskTitles.join('\n'),
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/' },
      tag: 'sparkflow-due',
    });

    let sent = 0;
    let removed = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
          removed++;
        } else {
          this.logger.warn(`Push failed for ${sub.id.slice(0, 8)}: ${err.message}`);
        }
      }
    }

    if (sent > 0 || removed > 0) {
      this.logger.log(`Push cron: sent=${sent} removed=${removed} tasks=${dueTasks.length}`);
    }
  }
}
