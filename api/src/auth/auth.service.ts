import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, CredentialsDto } from './dto/auth.dto';
import { hashPassword, verifyPassword } from './password';

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const NICKNAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private digest(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }

  private normalize(dto: CredentialsDto) {
    const identifier = dto.identifier.normalize('NFKC').trim().toLocaleLowerCase('und');
    if (dto.method === 'nickname') {
      const length = Array.from(identifier).length;
      if (length < 2 || length > 24 || !NICKNAME_PATTERN.test(identifier)) {
        throw new BadRequestException('invalid_nickname');
      }
    } else if (!/^\S+@\S+\.\S+$/.test(identifier)) {
      throw new BadRequestException('invalid_email');
    }
    return identifier;
  }

  private async consumeRateLimit(action: string, requestKey: string, limit: number, windowMs: number) {
    const windowStartedAt = new Date(Math.floor(Date.now() / windowMs) * windowMs);
    const key = this.digest(requestKey);
    const attempt = await this.prisma.authRateLimit.upsert({
      where: { requestKey_action_windowStartedAt: { requestKey: key, action, windowStartedAt } },
      create: { requestKey: key, action, windowStartedAt },
      update: { attemptCount: { increment: 1 } },
    });
    if (attempt.attemptCount > limit) {
      throw new HttpException('rate_limited', HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.prisma.authRateLimit.deleteMany({
      where: { windowStartedAt: { lt: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    });
  }

  private publicUser(user: { id: string; email: string | null; nickname: string | null }) {
    return { id: user.id, email: user.email, nickname: user.nickname };
  }

  private async issueSession(user: { id: string; email: string | null; nickname: string | null }) {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.authSession.create({
      data: {
        userId: user.id,
        tokenHash: this.digest(token),
        expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      },
    });
    await this.prisma.authSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { token, user: this.publicUser(user) };
  }

  async register(dto: CredentialsDto, remoteAddress: string) {
    const identifier = this.normalize(dto);
    await this.consumeRateLimit('register', `${remoteAddress}:${identifier}`, 5, 60 * 60 * 1000);
    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.method === 'email' ? identifier : null,
          loginNickname: dto.method === 'nickname' ? identifier : null,
          nickname: dto.method === 'nickname' ? identifier : identifier.split('@')[0],
          passwordHash,
        },
      });
      return this.issueSession(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(dto.method === 'nickname' ? 'nickname_taken' : 'email_taken');
      }
      throw error;
    }
  }

  async login(dto: CredentialsDto, remoteAddress: string) {
    const identifier = this.normalize(dto);
    await this.consumeRateLimit('login', `${remoteAddress}:${identifier}`, 10, 15 * 60 * 1000);
    const user = dto.method === 'nickname'
      ? await this.prisma.user.findUnique({ where: { loginNickname: identifier } })
      : await this.prisma.user.findUnique({ where: { email: identifier } });
    if (!user?.passwordHash || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('invalid_credentials');
    }
    return this.issueSession(user);
  }

  async currentUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('invalid_session');
    return { user: this.publicUser(user) };
  }

  async logout(token: string) {
    await this.prisma.authSession.updateMany({
      where: { tokenHash: this.digest(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash || !(await verifyPassword(dto.oldPassword, user.passwordHash))) {
      throw new UnauthorizedException('invalid_current_password');
    }
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(user);
  }
}
