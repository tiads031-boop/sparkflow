import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { google, Auth } from 'googleapis';
import { CodeChallengeMethod } from 'google-auth-library';
import * as crypto from 'crypto';

const TOKEN_ALGORITHM = 'aes-256-gcm';
const TOKEN_IV_LENGTH = 16;
const TOKEN_TAG_LENGTH = 16;
const REFRESH_WINDOW_MS = 5 * 60 * 1000;
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

type OAuthPlatform = 'web' | 'android';

interface OAuthStatePayload {
  userId: string;
  platform: OAuthPlatform;
  codeVerifier: string;
  expiresAt: number;
  nonce: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async generateAuthUrl(
    userId: string,
    platform: OAuthPlatform = 'web',
  ): Promise<{ url: string }> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }
    if (!['web', 'android'].includes(platform)) {
      throw new BadRequestException('platform must be web or android');
    }

    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.encodeOAuthState({
      userId,
      platform,
      codeVerifier,
      expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
      nonce: crypto.randomBytes(16).toString('base64url'),
    });

    const oauth2Client = new google.auth.OAuth2(clientId, '', redirectUri);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      code_challenge_method: CodeChallengeMethod.S256,
      code_challenge: codeChallenge,
      state,
      prompt: 'consent',
    });

    this.logger.log(`Generated OAuth URL for user ${userId} (${platform})`);
    return { url };
  }

  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ googleEmail: string; userId: string; platform: OAuthPlatform }> {
    if (!code || !state) {
      throw new BadRequestException('code and state are required');
    }

    const oauthState = this.decodeOAuthState(state);
    const { userId, platform, codeVerifier } = oauthState;
    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    try {
      const { tokens } = await oauth2Client.getToken({
        code,
        codeVerifier,
      });

      if (!tokens.access_token) {
        throw new UnauthorizedException('Google did not return access_token');
      }

      const tokenInfo = await oauth2Client.getTokenInfo(tokens.access_token);
      const googleEmail = tokenInfo.email ?? undefined;
      const existingToken = await this.prisma.googleToken.findUnique({
        where: { userId },
      });

      if (!tokens.refresh_token && !existingToken?.refreshToken) {
        throw new UnauthorizedException('Google did not return refresh_token');
      }

      const encryptKey = this.getEncryptionKey();
      const encryptedAccess = this.encrypt(tokens.access_token, encryptKey);
      const encryptedRefresh = tokens.refresh_token
        ? this.encrypt(tokens.refresh_token, encryptKey)
        : existingToken!.refreshToken;
      const tokenExpiry = tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000);

      await this.prisma.googleToken.upsert({
        where: { userId },
        update: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiry,
          googleEmail,
          isActive: true,
          syncToken: null,
        },
        create: {
          userId,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenExpiry,
          googleEmail,
        },
      });

      this.logger.log(
        `OAuth callback successful for user ${userId} (${googleEmail})`,
      );

      return { googleEmail: googleEmail ?? 'unknown', userId, platform };
    } catch (error) {
      this.logger.error(`OAuth callback failed for user ${userId}`, error);
      throw new UnauthorizedException('Failed to exchange authorization code');
    }
  }

  async getClient(userId: string): Promise<Auth.OAuth2Client> {
    const tokenRecord = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!tokenRecord || !tokenRecord.isActive) {
      throw new UnauthorizedException(
        'Google Calendar not connected for this user',
      );
    }

    const clientId = this.config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI');

    const encryptKey = this.getEncryptionKey();
    const accessToken = this.decrypt(tokenRecord.accessToken, encryptKey);
    const refreshToken = this.decrypt(tokenRecord.refreshToken, encryptKey);

    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri,
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: tokenRecord.tokenExpiry.getTime(),
    });

    const now = Date.now();
    if (tokenRecord.tokenExpiry.getTime() - now < REFRESH_WINDOW_MS) {
      this.logger.log(`Refreshing access token for user ${userId}`);
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();

        if (credentials.access_token) {
          const encryptedAccess = this.encrypt(
            credentials.access_token,
            encryptKey,
          );
          const newExpiry = credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

          await this.prisma.googleToken.update({
            where: { userId },
            data: {
              accessToken: encryptedAccess,
              tokenExpiry: newExpiry,
            },
          });

          oauth2Client.setCredentials({
            ...credentials,
            refresh_token: credentials.refresh_token ?? refreshToken,
          });
        }
      } catch (error) {
        this.logger.error(`Token refresh failed for user ${userId}`, error);
        throw new UnauthorizedException('Failed to refresh Google access token');
      }
    }

    return oauth2Client;
  }

  async disconnect(userId: string): Promise<void> {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    await this.prisma.googleToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, syncToken: null },
    });
    this.logger.log(`Disconnected Google Calendar for user ${userId}`);
  }

  async getStatus(userId: string) {
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const token = await this.prisma.googleToken.findUnique({
      where: { userId },
    });

    if (!token || !token.isActive) {
      return {
        isConnected: false,
        googleEmail: null,
        lastSyncAt: null,
        syncedCount: 0,
      };
    }

    const [syncedCount, pendingCount, conflictCount] = await Promise.all([
      this.prisma.calendarEvent.count({
        where: { userId, syncStatus: 'synced' },
      }),
      this.prisma.calendarEvent.count({
        where: { userId, syncStatus: 'pending' },
      }),
      this.prisma.calendarEvent.count({
        where: { userId, syncStatus: 'conflict' },
      }),
    ]);

    return {
      isConnected: true,
      googleEmail: token.googleEmail,
      lastSyncAt: token.lastSyncAt,
      syncedCount,
      pendingCount,
      conflictCount,
    };
  }

  peekOAuthPlatform(state?: string): OAuthPlatform {
    if (!state) return 'web';

    try {
      return this.decodeOAuthState(state).platform;
    } catch {
      return 'web';
    }
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url').replace(/=/g, '');
  }

  private generateCodeChallenge(verifier: string): string {
    return crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64url')
      .replace(/=/g, '');
  }

  private encodeOAuthState(payload: OAuthStatePayload): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(TOKEN_IV_LENGTH);
    const cipher = crypto.createCipheriv(TOKEN_ALGORITHM, key, iv, {
      authTagLength: TOKEN_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64url');
  }

  private decodeOAuthState(state: string): OAuthStatePayload {
    try {
      const key = this.getEncryptionKey();
      const buffer = Buffer.from(state, 'base64url');
      const iv = buffer.subarray(0, TOKEN_IV_LENGTH);
      const tag = buffer.subarray(
        TOKEN_IV_LENGTH,
        TOKEN_IV_LENGTH + TOKEN_TAG_LENGTH,
      );
      const encrypted = buffer.subarray(TOKEN_IV_LENGTH + TOKEN_TAG_LENGTH);
      const decipher = crypto.createDecipheriv(TOKEN_ALGORITHM, key, iv, {
        authTagLength: TOKEN_TAG_LENGTH,
      });
      decipher.setAuthTag(tag);
      const payload = JSON.parse(
        Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
          'utf8',
        ),
      ) as OAuthStatePayload;

      if (!payload.userId || !payload.codeVerifier || !payload.expiresAt) {
        throw new Error('OAuth state is missing required fields');
      }
      if (!['web', 'android'].includes(payload.platform)) {
        throw new Error('OAuth state has invalid platform');
      }
      if (payload.expiresAt < Date.now()) {
        throw new Error('OAuth state expired');
      }

      return payload;
    } catch {
      this.logger.warn('Invalid OAuth state received');
      throw new UnauthorizedException('Invalid OAuth state');
    }
  }

  private getEncryptionKey(): Buffer {
    const key = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new Error(
        'TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)',
      );
    }
    return Buffer.from(key, 'hex');
  }

  private encrypt(plaintext: string, key: Buffer): string {
    const iv = crypto.randomBytes(TOKEN_IV_LENGTH);
    const cipher = crypto.createCipheriv(TOKEN_ALGORITHM, key, iv, {
      authTagLength: TOKEN_TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(ciphertext: string, key: Buffer): string {
    const buffer = Buffer.from(ciphertext, 'base64');
    const iv = buffer.subarray(0, TOKEN_IV_LENGTH);
    const tag = buffer.subarray(
      TOKEN_IV_LENGTH,
      TOKEN_IV_LENGTH + TOKEN_TAG_LENGTH,
    );
    const encrypted = buffer.subarray(TOKEN_IV_LENGTH + TOKEN_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(TOKEN_ALGORITHM, key, iv, {
      authTagLength: TOKEN_TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  }
}
