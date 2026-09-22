import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { AppUsageService, type UsageIntervalInput } from './app-usage.service';

@Controller('app-usage')
export class AppUsageController {
  constructor(private readonly usage: AppUsageService) {}

  @Get('settings') settings(@CurrentUserId() userId: string) {
    return this.usage.settings(userId);
  }

  @Patch('settings') setEnabled(
    @CurrentUserId() userId: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.usage.setEnabled(userId, body?.enabled);
  }

  @Post('mappings') setMapping(
    @CurrentUserId() userId: string,
    @Body()
    body: {
      packageName: string;
      appName: string;
      tagId?: string | null;
      enabled?: boolean;
    },
  ) {
    return this.usage.setMapping(userId, body);
  }

  @Delete('mappings/:packageName') remove(
    @CurrentUserId() userId: string,
    @Param('packageName') packageName: string,
  ) {
    return this.usage.removeMapping(userId, packageName);
  }

  @Post('sessions') ingest(
    @CurrentUserId() userId: string,
    @Body() body: { intervals: UsageIntervalInput[] },
  ) {
    return this.usage.ingest(userId, body?.intervals);
  }

  @Get('sessions') sessions(
    @CurrentUserId() userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.usage.sessions(userId, start, end);
  }
}
