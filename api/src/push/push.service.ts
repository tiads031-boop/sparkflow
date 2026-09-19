import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as webpush from 'web-push';
import * as admin from 'firebase-admin';
import type { Prisma } from '@prisma/client';
import {
  groupReminderTasksByUser,
  REMINDER_GRACE_MS,
  type ReminderTask,
} from './push-reminder';
import {
  buildNotificationDeliveryKey,
  courseReminderScheduledFor,
  MAX_NOTIFICATION_LEAD_MINUTES,
  mergeNotificationSettings,
  normalizeNotificationPreferencesPatch,
  parseNotificationPreferences,
  shouldDeliverCourseReminder,
  shouldDeliverReminder,
  taskReminderScheduledFor,
  type CourseReminderEvent,
  type NotificationPreferences,
} from './push-preferences';

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

  async getNotificationPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    return parseNotificationPreferences(user?.settings);
  }

  async updateNotificationPreferences(
    userId: string,
    patch: Partial<NotificationPreferences>,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });
    const current = parseNotificationPreferences(user?.settings);
    const next = normalizeNotificationPreferencesPatch(current, patch);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        settings: mergeNotificationSettings(
          user?.settings,
          next,
        ) as unknown as Prisma.InputJsonValue,
      },
    });

    return next;
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
    const recentStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const dueEnd = new Date(
      now.getTime() + MAX_NOTIFICATION_LEAD_MINUTES * 60_000,
    );

    const reminderCandidates = await this.prisma.task.findMany({
      where: {
        status: { notIn: ['done', 'cancelled'] },
        OR: [
          {
            reminderAt: {
              gte: recentStart,
              lte: now,
            },
          },
          {
            reminderAt: null,
            dueDate: {
              gte: recentStart,
              lte: dueEnd,
            },
          },
        ],
      },
      select: {
        id: true,
        userId: true,
        title: true,
        dueDate: true,
        reminderAt: true,
      },
      orderBy: [
        { reminderAt: 'asc' },
        { dueDate: 'asc' },
      ],
      take: 500,
    }) as ReminderTask[];

    if (reminderCandidates.length === 0) return;

    const candidateGroups = groupReminderTasksByUser(reminderCandidates);
    const candidateUserIds = [...candidateGroups.keys()];
    const users = await this.prisma.user.findMany({
      where: { id: { in: candidateUserIds } },
      select: { id: true, settings: true },
    });
    const preferencesByUser = new Map(
      users.map((user) => [
        user.id,
        parseNotificationPreferences(user.settings),
      ]),
    );

    const tasksByUser = new Map<string, ReminderTask[]>();
    for (const [userId, tasks] of candidateGroups) {
      const preferences = preferencesByUser.get(userId)
        || parseNotificationPreferences(undefined);
      const eligible = tasks.filter((task) =>
        shouldDeliverReminder(task, preferences, now),
      );
      if (eligible.length > 0) tasksByUser.set(userId, eligible);
    }

    if (tasksByUser.size === 0) return;

    const userIds = [...tasksByUser.keys()];
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: userIds } },
    });
    if (subs.length === 0) return;

    const candidateKeys = subs.flatMap((sub) => {
      const preferences = preferencesByUser.get(sub.userId)
        || parseNotificationPreferences(undefined);
      return (tasksByUser.get(sub.userId) || []).flatMap((task) => {
        const scheduledFor = taskReminderScheduledFor(task, preferences);
        return scheduledFor
          ? [buildNotificationDeliveryKey(
              'task',
              task.userId,
              task.id,
              scheduledFor,
              sub.id,
            )]
          : [];
      });
    });

    const existingDeliveries = candidateKeys.length
      ? await this.prisma.notificationDelivery.findMany({
          where: { deliveryKey: { in: candidateKeys } },
          select: { deliveryKey: true },
        })
      : [];
    const deliveredKeys = new Set(existingDeliveries.map((item) => item.deliveryKey));

    let webSent = 0;
    let fcmSent = 0;
    let removed = 0;
    let deliveredTaskCount = 0;

    for (const sub of subs) {
      const userTasks = tasksByUser.get(sub.userId) || [];
      const preferences = preferencesByUser.get(sub.userId)
        || parseNotificationPreferences(undefined);
      const pendingTasks = userTasks.filter((task) => {
        const scheduledFor = taskReminderScheduledFor(task, preferences);
        if (!scheduledFor) return false;
        return !deliveredKeys.has(buildNotificationDeliveryKey(
          'task',
          task.userId,
          task.id,
          scheduledFor,
          sub.id,
        ));
      });
      if (pendingTasks.length === 0) continue;

      const notification = {
        title: pendingTasks.length === 1 ? '任务提醒' : `${pendingTasks.length} 个任务提醒`,
        body: pendingTasks
          .map((task) => task.title)
          .slice(0, 5)
          .join('\n'),
      };

      const webPayload = JSON.stringify({
        ...notification,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { url: '/' },
        tag: 'sparkflow-task-reminder',
      });

      const fcmPayload: admin.messaging.NotificationMessagePayload = {
        title: notification.title,
        body: notification.body,
      };

      let sent = false;

      if (sub.channel === 'fcm') {
        if (!this.fcmApp) continue;
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
          await this.fcmApp.messaging().send(msg);
          fcmSent++;
          sent = true;
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
          sent = true;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed++;
          } else {
            this.logger.warn(`WebPush failed for ${sub.id.slice(0, 8)}: ${err.message}`);
          }
        }
      }

      if (!sent) continue;

      await this.prisma.notificationDelivery.createMany({
        data: pendingTasks.flatMap((task) => {
          const scheduledFor = taskReminderScheduledFor(task, preferences);
          if (!scheduledFor) return [];
          return [{
            userId: task.userId,
            sourceType: 'task',
            sourceId: task.id,
            subscriptionId: sub.id,
            deliveryKey: buildNotificationDeliveryKey(
              'task',
              task.userId,
              task.id,
              scheduledFor,
              sub.id,
            ),
            scheduledFor,
            channel: sub.channel,
          }];
        }),
        skipDuplicates: true,
      });
      deliveredTaskCount += pendingTasks.length;
    }

    const total = webSent + fcmSent;
    if (total > 0 || removed > 0) {
      this.logger.log(
        `Push cron: web=${webSent} fcm=${fcmSent} removed=${removed} reminders=${deliveredTaskCount} users=${userIds.length}`,
      );
    }
  }

  // ── 定时扫描：课程开始提醒 ──

  @Cron('*/1 * * * *')
  async notifyUpcomingCourses() {
    if (!this.vapidReady && !this.fcmApp) return;

    const now = new Date();
    const rangeStart = new Date(now.getTime() - REMINDER_GRACE_MS);
    const rangeEnd = new Date(
      now.getTime() + MAX_NOTIFICATION_LEAD_MINUTES * 60_000,
    );

    const candidates = await this.prisma.calendarEvent.findMany({
      where: {
        courseId: { not: null },
        startTime: { lte: rangeEnd },
        endTime: { gt: rangeStart },
        OR: [
          { overrideType: null },
          { overrideType: { not: 'cancel' } },
        ],
      },
      select: {
        id: true,
        userId: true,
        title: true,
        startTime: true,
        endTime: true,
        location: true,
      },
      orderBy: { startTime: 'asc' },
      take: 500,
    });

    if (!candidates.length) return;

    const userIds = [...new Set(candidates.map((event) => event.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, settings: true },
    });
    const preferencesByUser = new Map(
      users.map((user) => [
        user.id,
        parseNotificationPreferences(user.settings),
      ]),
    );

    const eventsByUser = new Map<string, CourseReminderEvent[]>();
    for (const event of candidates) {
      const preferences = preferencesByUser.get(event.userId)
        || parseNotificationPreferences(undefined);
      if (!shouldDeliverCourseReminder(event, preferences, now)) continue;
      const bucket = eventsByUser.get(event.userId) || [];
      bucket.push(event);
      eventsByUser.set(event.userId, bucket);
    }
    if (!eventsByUser.size) return;

    const eligibleUserIds = [...eventsByUser.keys()];
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: eligibleUserIds } },
    });
    if (!subs.length) return;

    const candidateKeys = subs.flatMap((sub) => {
      const preferences = preferencesByUser.get(sub.userId)
        || parseNotificationPreferences(undefined);
      return (eventsByUser.get(sub.userId) || []).map((event) =>
        buildNotificationDeliveryKey(
          'course',
          event.userId,
          event.id,
          courseReminderScheduledFor(event, preferences),
          sub.id,
        ),
      );
    });

    const existingDeliveries = candidateKeys.length
      ? await this.prisma.notificationDelivery.findMany({
          where: { deliveryKey: { in: candidateKeys } },
          select: { deliveryKey: true },
        })
      : [];
    const deliveredKeys = new Set(
      existingDeliveries.map((item) => item.deliveryKey),
    );

    let webSent = 0;
    let fcmSent = 0;
    let removed = 0;
    let deliveredCourseCount = 0;

    for (const sub of subs) {
      const preferences = preferencesByUser.get(sub.userId)
        || parseNotificationPreferences(undefined);
      const pendingEvents = (eventsByUser.get(sub.userId) || []).filter((event) =>
        !deliveredKeys.has(buildNotificationDeliveryKey(
          'course',
          event.userId,
          event.id,
          courseReminderScheduledFor(event, preferences),
          sub.id,
        )),
      );
      if (!pendingEvents.length) continue;

      const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
        timeZone: preferences.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const notification = {
        title: pendingEvents.length === 1
          ? '课程提醒'
          : `${pendingEvents.length} 节课程提醒`,
        body: pendingEvents
          .slice(0, 5)
          .map((event) => {
            return `${timeFormatter.format(event.startTime)} ${event.title}${event.location ? ` · ${event.location}` : ''}`;
          })
          .join('\n'),
      };

      const webPayload = JSON.stringify({
        ...notification,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: { url: '/' },
        tag: 'sparkflow-course-reminder',
      });
      const fcmPayload: admin.messaging.NotificationMessagePayload = {
        title: notification.title,
        body: notification.body,
      };

      let sent = false;
      if (sub.channel === 'fcm') {
        if (!this.fcmApp) continue;
        try {
          await this.fcmApp.messaging().send({
            token: sub.endpoint,
            notification: fcmPayload,
            data: { url: '/' },
            android: {
              notification: {
                channelId: 'sparkflow-courses',
                icon: 'ic_stat_sparkflow',
                color: '#b0a8db',
              },
            },
          });
          fcmSent += 1;
          sent = true;
        } catch (err: any) {
          if (
            err.code === 'messaging/registration-token-not-registered'
            || err.code === 'messaging/invalid-argument'
          ) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed += 1;
          } else {
            this.logger.warn(
              `FCM course push failed for ${sub.id.slice(0, 8)}: ${err.message}`,
            );
          }
        }
      } else {
        if (!this.vapidReady || !sub.p256dh || !sub.auth) continue;
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            webPayload,
          );
          webSent += 1;
          sent = true;
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
            removed += 1;
          } else {
            this.logger.warn(
              `Web course push failed for ${sub.id.slice(0, 8)}: ${err.message}`,
            );
          }
        }
      }

      if (!sent) continue;

      await this.prisma.notificationDelivery.createMany({
        data: pendingEvents.map((event) => ({
          userId: event.userId,
          sourceType: 'course',
          sourceId: event.id,
          subscriptionId: sub.id,
          deliveryKey: buildNotificationDeliveryKey(
            'course',
            event.userId,
            event.id,
            courseReminderScheduledFor(event, preferences),
            sub.id,
          ),
          scheduledFor: courseReminderScheduledFor(event, preferences),
          channel: sub.channel,
        })),
        skipDuplicates: true,
      });
      deliveredCourseCount += pendingEvents.length;
    }

    const total = webSent + fcmSent;
    if (total > 0 || removed > 0) {
      this.logger.log(
        `Course push cron: web=${webSent} fcm=${fcmSent} removed=${removed} reminders=${deliveredCourseCount} users=${eligibleUserIds.length}`,
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
