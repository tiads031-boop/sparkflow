import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import * as admin from 'firebase-admin';

interface WebPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private fcmApp: admin.app.App | null = null;
  private vapidReady = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.initVapid();
    this.initFcm();
  }

  // ── VAPID (Web Push) 初始化 ──

  private initVapid() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.config.get<string>('VAPID_SUBJECT') || 'mailto:admin@sparkflow.local';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.vapidReady = true;
      this.logger.log('VAPID (Web Push) configured');
    } else {
      this.logger.warn('VAPID keys missing — Web Push disabled');
    }
  }

  // ── FCM (Firebase Cloud Messaging) 初始化 ──

  private initFcm() {
    const credPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (!credPath) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_PATH not set — FCM push disabled');
      return;
    }

    try {
      // resolve 相对路径（相对于项目根 api/）
      const path = require('path');
      const absolutePath = credPath.startsWith('.')
        ? path.resolve(process.cwd(), credPath)
        : credPath;

      this.fcmApp = admin.initializeApp(
        {
          credential: admin.credential.cert(absolutePath),
        },
        'fcm-push', // 独立命名，避免与其他 firebase app 冲突
      );
      this.logger.log(`FCM initialized: ${absolutePath}`);
    } catch (err: any) {
      this.logger.error(`FCM init failed: ${err.message}`);
    }
  }

  // ── 公钥接口 ──

  getVapidPublicKey(): string | null {
    return this.config.get<string>('VAPID_PUBLIC_KEY') || null;
  }

  // ── 订阅 ──

  async subscribe(
    userId: string,
    subscription: {
      endpoint: string;
      channel?: 'web' | 'fcm';
      keys?: { p256dh: string; auth: string };
    },
  ) {
    const channel = subscription.channel || 'web';
    const existing = await this.prisma.pushSubscription.findFirst({
      where: { userId, endpoint: subscription.endpoint, channel },
    });

    // 清理同用户同通道的其他端点
    await this.prisma.pushSubscription.deleteMany({
      where: {
        userId,
        channel,
        ...(existing ? { id: { not: existing.id } } : {}),
        endpoint: { not: subscription.endpoint },
      },
    });

    if (existing) {
      return this.prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          p256dh: subscription.keys?.p256dh || null,
          auth: subscription.keys?.auth || null,
        },
      });
    }

    return this.prisma.pushSubscription.create({
      data: {
        userId,
        channel,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || null,
        auth: subscription.keys?.auth || null,
      },
    });
  }

  // ── 取消订阅 ──

  async unsubscribe(userId: string, endpoint?: string, channel?: string) {
    const where: any = { userId };
    if (endpoint) where.endpoint = endpoint;
    if (channel) where.channel = channel;

    const subs = await this.prisma.pushSubscription.findMany({ where });
    if (subs.length === 0) return { deleted: 0 };

    await this.prisma.pushSubscription.deleteMany({ where });
    return { deleted: subs.length };
  }

  async getUserSubscriptionCount(userId: string): Promise<number> {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  // ── 定时扫描：即将到期任务推送 ──

  @Cron('*/1 * * * *')
  async notifyDueTasks() {
    if (!this.vapidReady && !this.fcmApp) return;

    const now = new Date();
    const window = new Date(now.getTime() + 30 * 60 * 1000);

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
      const date = t.dueDate
        ? new Date(t.dueDate).toISOString().slice(0, 10)
        : '';
      return `${t.title} (${date})`;
    });

    const notification = {
      title: `${dueTasks.length} tasks due soon`,
      body: taskTitles.join('\n'),
    };

    const webPayload = JSON.stringify({
      ...notification,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/' },
      tag: 'sparkflow-due',
    });

    const fcmPayload: admin.messaging.NotificationMessagePayload = {
      title: notification.title,
      body: notification.body,
    };

    let webSent = 0;
    let fcmSent = 0;
    let removed = 0;

    for (const sub of subs) {
      if (sub.channel === 'fcm') {
        // ── FCM 通道 ──
        try {
          const msg: admin.messaging.Message = {
            token: sub.endpoint,
            notification: fcmPayload,
            data: { url: '/' },
            android: {
              notification: {
                channelId: 'sparkflow-tasks',
                icon: 'ic_stat_sparkflow',
                color: '#cae393',
              },
            },
          };
          await this.fcmApp!.messaging().send(msg);
          fcmSent++;
        } catch (err: any) {
          if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-argument'
          ) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed++;
          } else {
            this.logger.warn(`FCM push failed for ${sub.id.slice(0, 8)}: ${err.message}`);
          }
        }
      } else {
        // ── Web Push 通道 ──
        if (!this.vapidReady || !sub.p256dh || !sub.auth) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            webPayload,
          );
          webSent++;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed++;
          } else {
            this.logger.warn(`WebPush failed for ${sub.id.slice(0, 8)}: ${err.message}`);
          }
        }
      }
    }

    const total = webSent + fcmSent;
    if (total > 0 || removed > 0) {
      this.logger.log(
        `Push cron: web=${webSent} fcm=${fcmSent} removed=${removed} tasks=${dueTasks.length}`,
      );
    }
  }

  // ── 诊断用：测试推送 ──

  async sendTestNotification(userId?: string) {
    if (!this.vapidReady && !this.fcmApp) {
      return { ok: false, reason: 'No push channels configured' };
    }

    const subs = userId
      ? await this.prisma.pushSubscription.findMany({ where: { userId } })
      : await this.prisma.pushSubscription.findMany();

    if (subs.length === 0) {
      return { ok: false, reason: `No subscriptions found${userId ? ' for user ' + userId : ''}` };
    }

    const notification = {
      title: 'SparkFlow Test Notification',
      body: `Push pipeline OK! Subscriptions: ${subs.length}`,
    };

    const webPayload = JSON.stringify({
      ...notification,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: { url: '/' },
      tag: 'sparkflow-test',
    });

    const fcmPayload: admin.messaging.NotificationMessagePayload = {
      title: notification.title,
      body: notification.body,
    };

    let webSent = 0;
    let fcmSent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      if (sub.channel === 'fcm') {
        try {
          const msg: admin.messaging.Message = {
            token: sub.endpoint,
            notification: fcmPayload,
            data: { url: '/' },
            android: {
              notification: {
                channelId: 'sparkflow-test',
                icon: 'ic_stat_sparkflow',
                color: '#cae393',
              },
            },
          };
          await this.fcmApp!.messaging().send(msg);
          fcmSent++;
        } catch (err: any) {
          failed++;
          errors.push(`fcm:${sub.id.slice(0, 8)}: ${err.code || err.message}`);
        }
      } else {
        if (!this.vapidReady || !sub.p256dh || !sub.auth) {
          failed++;
          errors.push(`web:${sub.id.slice(0, 8)}: missing keys`);
          continue;
        }
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            webPayload,
          );
          webSent++;
        } catch (err: any) {
          failed++;
          errors.push(`web:${sub.id.slice(0, 8)}: ${err.statusCode || err.message}`);
        }
      }
    }

    const total = webSent + fcmSent;
    return {
      ok: total > 0,
      channels: { web: webSent, fcm: fcmSent },
      subscriptions: subs.length,
      total,
      failed,
      errors: errors.slice(0, 5),
    };
  }
}
