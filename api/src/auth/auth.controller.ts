import { Body, Controller, Get, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto, CredentialsDto } from './dto/auth.dto';

function bearerToken(authorization?: string): string {
  return authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Public()
  register(@Body() dto: CredentialsDto, @Req() request: Request) {
    return this.auth.register(dto, request.ip || request.socket.remoteAddress || 'unknown');
  }

  @Post('login')
  @Public()
  login(@Body() dto: CredentialsDto, @Req() request: Request) {
    return this.auth.login(dto, request.ip || request.socket.remoteAddress || 'unknown');
  }

  @Get('session')
  session(@CurrentUserId() userId: string) {
    return this.auth.currentUser(userId);
  }

  @Post('logout')
  logout(@Headers('authorization') authorization?: string) {
    return this.auth.logout(bearerToken(authorization));
  }

  @Post('change-password')
  changePassword(@CurrentUserId() userId: string, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(userId, dto);
  }
}
