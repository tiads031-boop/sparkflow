import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.configService.get<string>('API_KEY');

    // 如果未配置 API_KEY，则跳过验证（本地开发便利）
    if (!apiKey) {
      return true;
    }

    const headerKey = request.headers['x-api-key'];
    if (headerKey !== apiKey) {
      throw new UnauthorizedException('Invalid or missing API key');
    }

    return true;
  }
}
