import { Controller, Get, Post, Delete, Patch, Body } from '@nestjs/common';
import { PushService } from './push.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import type { NotificationPreferences } from './push-preferences';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** 前端获取 VAPID 公钥（PWA 的 Service Worker 注册时需要） */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    const key = this.pushService.getVapidPublicKey();
    return { publicKey: key };
  }

  /** 当前账户的通知偏好。 */
  @Get('preferences')
  getPreferences(@CurrentUserId() userId: string) {
    return this.pushService.getNotificationPreferences(userId);
  }

  /** 更新当前账户的通知偏好；只接受已知字段。 */
  @Patch('preferences')
  updatePreferences(
    @CurrentUserId() userId: string,
    @Body() patch: Partial<NotificationPreferences>,
  ) {
    return this.pushService.updateNotificationPreferences(userId, patch);
  }

  /**
   * 订阅推送（双通道）
   *
   * Web Push: { userId, subscription: { endpoint, keys: { p256dh, auth } } }
   * FCM:      { userId, subscription: { endpoint: "FCM-token...", channel: "fcm" } }
   */
  @Post('subscribe')
  subscribe(
    @CurrentUserId() userId: string,
    @Body()
    data: {
      userId?: string;
      subscription: {
        endpoint: string;
        channel?: 'web' | 'fcm';
        keys?: { p256dh: string; auth: string };
      };
    },
  ) {
    return this.pushService.subscribe(userId, data.subscription);
  }

  /**
   * 取消订阅
   *
   * Web Push: { userId, endpoint: "https://..." }
   * FCM:      { userId, channel: "fcm" }  或  { userId, endpoint: "FCM-token..." }
   */
  @Delete('unsubscribe')
  unsubscribe(
    @CurrentUserId() userId: string,
    @Body()
    data: {
      userId?: string;
      endpoint?: string;
      channel?: string;
    },
  ) {
    return this.pushService.unsubscribe(userId, data.endpoint, data.channel);
  }

  /** 诊断：手动触发一次推送测试（双通道） */
  @Post('test')
  async testPush(@CurrentUserId() userId: string) {
    const result = await this.pushService.sendTestNotification(userId);
    return result;
  }
}
