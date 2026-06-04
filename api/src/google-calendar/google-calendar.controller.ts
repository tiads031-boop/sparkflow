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
import { GoogleAuthService } from './google-auth.service';
import { GoogleSyncService } from './google-sync.service';
import { AuthCallbackDto } from './dto/auth-callback.dto';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

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
    @Res() res: Response,
  ) {
    const fallbackPlatform = this.authService.peekOAuthPlatform(state);

    if (error) {
      return this.respondToOAuthCallback(res, fallbackPlatform, false, error);
    }

    try {
      const result = await this.authService.handleCallback(code, state);
      return this.respondToOAuthCallback(
        res,
        result.platform,
        true,
        result.googleEmail,
      );
    } catch (callbackError: any) {
      return this.respondToOAuthCallback(
        res,
        fallbackPlatform,
        false,
        callbackError?.message ?? 'OAuth failed',
      );
    }
  }

  /**
   * POST /api/google/auth/callback
   * JSON fallback for clients that cannot follow the redirect flow.
   */
  @Post('auth/callback')
  @HttpCode(HttpStatus.OK)
  async handleCallback(@Body() dto: AuthCallbackDto) {
    return this.authService.handleCallback(dto.code, dto.state);
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
    platform: 'web' | 'android',
    success: boolean,
    message: string,
  ) {
    const status = success ? 'success' : 'error';
    const escapedMessage = this.escapeHtml(message);

    if (platform === 'android') {
      const redirectUrl = `sparkflow://oauth?status=${status}`;
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
    <p>Google Calendar ${success ? 'connected' : 'connection failed'}.</p>
    <script>
      window.opener?.postMessage({ type: 'sparkflow-google-oauth', status: '${status}', message: '${escapedMessage}' }, '*');
      window.close();
    </script>
  </body>
</html>`);
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
