import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  GoogleAuthService,
  type OAuthCallbackErrorDetails,
} from './google-auth.service';
import { GoogleSyncService } from './google-sync.service';
import { AuthCallbackDto } from './dto/auth-callback.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

type OAuthPlatform = 'web' | 'android';
type OAuthCallbackStatus = 'success' | 'error';

interface OAuthCallbackPayload {
  type: 'sparkflow-google-oauth';
  status: OAuthCallbackStatus;
  message: string;
  errorCode?: OAuthCallbackErrorDetails['code'];
  googleError?: string;
  googleDescription?: string;
  googleErrorUri?: string;
  setupHint?: string;
}

@Controller('google')
@UseGuards(ApiKeyGuard)
export class GoogleCalendarController {
  constructor(
    private readonly authService: GoogleAuthService,
    private readonly syncService: GoogleSyncService,
  ) {}

  /**
   * GET /api/google/auth/url
   * Returns the Google OAuth authorization URL. PKCE verifier is stored in state.
   */
  @Get('auth/url')
  async getAuthUrl(
    @Query('userId') userId: string,
    @Query('platform') platform: 'web' | 'android' = 'web',
  ) {
    return this.authService.generateAuthUrl(userId, platform);
  }

  /**
   * GET /api/google/auth/callback
   * Google redirects here directly after OAuth.
   * ApiKeyGuard bypasses this route because Google cannot send X-API-Key.
   */
  @Get('auth/callback')
  async handleRedirectCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Query('error_uri') errorUri: string | undefined,
    @Res() res: Response,
  ) {
    const fallbackPlatform = this.authService.peekOAuthPlatform(state);

    if (error) {
      const details = this.authService.buildCallbackErrorDetails({
        error,
        errorDescription,
        errorUri,
      });
      return this.respondToOAuthCallback(res, fallbackPlatform, {
        type: 'sparkflow-google-oauth',
        status: 'error',
        message: details.message,
        errorCode: details.code,
        googleError: details.googleError,
        googleDescription: details.googleDescription,
        googleErrorUri: details.googleErrorUri,
        setupHint: details.setupHint,
      });
    }

    try {
      const result = await this.authService.handleCallback(code, state);
      return this.respondToOAuthCallback(res, result.platform, {
        type: 'sparkflow-google-oauth',
        status: 'success',
        message: result.googleEmail,
      });
    } catch (callbackError: any) {
      const details = this.authService.buildCallbackErrorDetails({
        fallbackMessage: callbackError?.message ?? 'OAuth failed',
      });
      return this.respondToOAuthCallback(res, fallbackPlatform, {
        type: 'sparkflow-google-oauth',
        status: 'error',
        message: details.message,
        errorCode: details.code,
        setupHint: details.setupHint,
      });
    }
  }

  /**
   * POST /api/google/auth/callback
   * JSON fallback for clients that cannot follow the redirect flow.
   */
  @Post('auth/callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Body() dto: AuthCallbackDto) {
    if (dto.error) {
      const details = this.authService.buildCallbackErrorDetails({
        error: dto.error,
        errorDescription: dto.error_description,
        errorUri: dto.error_uri,
      });
      return {
        success: false,
        ...details,
      };
    }

    return this.authService.handleCallback(dto.code!, dto.state!);
  }

  /**
   * GET /api/google/status
   * Returns the Google Calendar connection status and sync stats.
   */
  @Get('status')
  async getStatus(@Query('userId') userId: string) {
    return this.authService.getStatus(userId);
  }

  /**
   * POST /api/google/disconnect
   * Disconnects Google Calendar and clears tokens.
   */
  @Post('disconnect')
  @HttpCode(HttpStatus.OK)
  async disconnect(@Body('userId') userId: string) {
    await this.authService.disconnect(userId);
    return { message: 'Disconnected' };
  }

  /**
   * POST /api/google/sync
   * Manually triggers a full Google Calendar sync.
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async manualSync(@Body('userId') userId: string) {
    return this.syncService.manualSync(userId);
  }

  /**
   * GET /api/google/sync/status
   * Returns whether a sync is currently in progress.
   */
  @Get('sync/status')
  async getSyncStatus() {
    return {
      isSyncing: this.syncService.isSyncRunning,
    };
  }

  private respondToOAuthCallback(
    res: Response,
    platform: OAuthPlatform,
    payload: OAuthCallbackPayload,
  ) {
    const success = payload.status === 'success';
    const scriptPayload = JSON.stringify(payload).replace(/</g, '\\u003c');

    if (platform === 'android') {
      const redirectUrl = this.buildAndroidCallbackUrl(payload);
      return res.redirect(302, redirectUrl);
    }

    return res
      .status(success ? HttpStatus.OK : HttpStatus.UNAUTHORIZED)
      .type('html')
      .send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SparkFlow Google Calendar</title>
  </head>
  <body>
    <p>${this.escapeHtml(payload.message)}</p>
    ${
      payload.setupHint
        ? `<p>${this.escapeHtml(payload.setupHint)}</p>`
        : ''
    }
    <p>Google Calendar ${success ? 'connected' : 'connection failed'}.</p>
    <script>
      window.opener?.postMessage(${scriptPayload}, '*');
      window.close();
    </script>
  </body>
</html>`);
  }

  private buildAndroidCallbackUrl(payload: OAuthCallbackPayload): string {
    const params = new URLSearchParams({
      status: payload.status,
      message: payload.message,
    });

    if (payload.errorCode) params.set('errorCode', payload.errorCode);
    if (payload.googleError) params.set('googleError', payload.googleError);
    if (payload.googleDescription) {
      params.set('googleDescription', payload.googleDescription);
    }
    if (payload.googleErrorUri) {
      params.set('googleErrorUri', payload.googleErrorUri);
    }
    if (payload.setupHint) params.set('setupHint', payload.setupHint);

    return `sparkflow://oauth?${params.toString()}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
