import { Controller, Get, Post, Delete, Body } from '@nestjs/common';
import { PushService } from './push.service';

@Controller('push')
export class PushController {
  constructor(private readonly pushService: PushService) {}

  /** 前端获取 VAPID 公钥（无需认证，SW 注册时需要） */
  @Get('vapid-public-key')
  getVapidPublicKey() {
    const key = this.pushService.getVapidPublicKey();
    return { publicKey: key };
  }

  /** 浏览器订阅推送 */
  @Post('subscribe')
  subscribe(
    @Body() data: { userId: string; subscription: { endpoint: string; keys: { p256dh: string; auth: string } } },
  ) {
    return this.pushService.subscribe(data.userId, data.subscription);
  }

  /** 浏览器取消订阅 */
  @Delete('unsubscribe')
  unsubscribe(@Body() data: { userId: string; endpoint: string }) {
    return this.pushService.unsubscribe(data.userId, data.endpoint);
  }
}
