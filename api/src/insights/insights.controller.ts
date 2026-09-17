import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { InsightsService } from './insights.service';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.insights.findAll(userId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.insights.findOne(id, userId);
  }

  @Post('generate')
  generate(
    @CurrentUserId() userId: string,
    @Body() data: { days?: number },
  ) {
    return this.insights.generate(userId, data || {});
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body('status') status: string,
  ) {
    return this.insights.updateStatus(id, userId, status);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.insights.remove(id, userId);
  }
}
