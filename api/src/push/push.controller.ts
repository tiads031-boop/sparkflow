import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** 前端获取 VAPID 公钥（PWA 的 Service Worker 注册时需要） */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    const key = this.pushService.getVapidPublicKey();
    return { publicKey: key };
  }

  /**
   * 订阅推送（双通道）
   *
   * Web Push: { userId, subscription: { endpoint, keys: { p256dh, auth } } }
   * FCM:      { userId, subscription: { endpoint: "FCM-token...", channel: "fcm" } }
   */
  @Post('subscribe')
  subscribe(
    @Body()
    data: {
      userId: string;
      subscription: {
        endpoint: string;
        channel?: 'web' | 'fcm';
        keys?: { p256dh: string; auth: string };
      };
    },
  ) {
    return this.pushService.subscribe(data.userId, data.subscription);
  }

  /**
   * 取消订阅
   *
   * Web Push: { userId, endpoint: "https://..." }
   * FCM:      { userId, channel: "fcm" }  或  { userId, endpoint: "FCM-token..." }
   */
  @Delete('unsubscribe')
  unsubscribe(
    @Body()
    data: {
      userId: string;
      endpoint?: string;
      channel?: string;
    },
  ) {
    return this.pushService.unsubscribe(data.userId, data.endpoint, data.channel);
  }

  /** 诊断：手动触发一次推送测试（双通道） */
  @Post('test')
  async testPush(@Body() data: { userId?: string }) {
    const result = await this.pushService.sendTestNotification(data.userId);
    return result;
  }
}
