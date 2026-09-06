import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface SupabaseUserResponse {
  id?: string;
  email?: string;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    if (request.method === 'OPTIONS') return true;

    const supabaseUrl = this.config.get<string>('SUPABASE_URL')?.replace(/\/+$/, '');
    const publishableKey = this.config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    if (!supabaseUrl || !publishableKey) {
      if (this.config.get<string>('NODE_ENV') !== 'production') {
        const localUserId = this.config.get<string>('DEFAULT_USER_ID') || 'default';
        await this.prisma.user.upsert({
          where: { id: localUserId },
          update: {},
          create: { id: localUserId, nickname: 'Local user' },
        });
        request.authUserId = localUserId;
        return true;
      }
      throw new ServiceUnavailableException('Supabase authentication is not configured');
    }

    const authorization = request.headers.authorization;
    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    let response: Response;
    try {
      response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: publishableKey,
          Authorization: authorization,
        },
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException('Authentication service unavailable');
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new UnauthorizedException('Invalid or expired access token');

    const authUser = await response.json() as SupabaseUserResponse;
    if (!authUser.id) throw new UnauthorizedException('Invalid access token subject');

    await this.prisma.user.upsert({
      where: { id: authUser.id },
      update: {},
      create: {
        id: authUser.id,
        nickname: authUser.email?.split('@')[0] || 'SparkFlow user',
      },
    });
    request.authUserId = authUser.id;
    request.authUserEmail = authUser.email ?? null;
    return true;
  }
}
