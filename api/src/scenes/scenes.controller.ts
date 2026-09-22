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
import { ScenesService } from './scenes.service';
import { SceneAnalyticsService } from './scene-analytics.service';

@Controller('scenes')
export class ScenesController {
  constructor(
    private readonly scenes: ScenesService,
    private readonly analytics: SceneAnalyticsService,
  ) {}

  @Get() list(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
  ) {
    return this.scenes.list(userId, status);
  }
  @Post() create(@CurrentUserId() userId: string, @Body() input: unknown) {
    return this.scenes.create(userId, input);
  }
  @Post('reorder') reorder(
    @CurrentUserId() userId: string,
    @Body('ids') ids: unknown,
  ) {
    return this.scenes.reorder(userId, ids);
  }
  @Get(':id') get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.scenes.get(userId, id);
  }
  @Patch(':id') update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: unknown,
  ) {
    return this.scenes.update(userId, id, input);
  }
  @Patch(':id/archive') archive(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.scenes.setStatus(userId, id, 'archived');
  }
  @Patch(':id/restore') restore(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.scenes.setStatus(userId, id, 'active');
  }
  @Get(':id/entries') entries(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query()
    query: { start?: string; end?: string; cursor?: string; limit?: string },
  ) {
    return this.scenes.entries(userId, id, query);
  }
  @Post(':id/entries') createEntry(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() input: Parameters<ScenesService['createEntry']>[2],
  ) {
    return this.scenes.createEntry(userId, id, input);
  }
  @Patch(':id/entries/:entryId') updateEntry(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() input: Record<string, unknown>,
  ) {
    return this.scenes.updateEntry(userId, id, entryId, input);
  }
  @Delete(':id/entries/:entryId') deleteEntry(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.scenes.deleteEntry(userId, id, entryId);
  }
  @Get(':id/analytics') analyticsSummary(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query() query: Parameters<SceneAnalyticsService['summarize']>[2],
  ) {
    return this.analytics.summarize(userId, id, query);
  }
}
