import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('time')
  getTime(
    @CurrentUserId() userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timeZone') timeZone = 'UTC',
    @Query('bucket') bucket = 'day',
    @Query('dimension') dimension = 'tag',
  ) {
    return this.analytics.getTime(
      userId,
      start,
      end,
      timeZone,
      bucket,
      dimension,
    );
  }

  @Get('plan-actual')
  getPlanActual(
    @CurrentUserId() userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timeZone') timeZone = 'UTC',
    @Query('groupBy') groupBy = 'day',
  ) {
    return this.analytics.getPlanActual(userId, start, end, timeZone, groupBy);
  }

  @Get('heatmap')
  getHeatmap(
    @CurrentUserId() userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timeZone') timeZone = 'UTC',
    @Query('filterType') filterType = 'all',
    @Query('filterId') filterId?: string,
  ) {
    return this.analytics.getHeatmap(
      userId,
      start,
      end,
      timeZone,
      filterType,
      filterId,
    );
  }
}
