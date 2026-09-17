import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { InspirationsService } from './inspirations.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('inspirations')
export class InspirationsController {
  constructor(private readonly inspirationsService: InspirationsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.inspirationsService.findAll(userId, status);
  }

  @Get('review/queue')
  getReviewQueue(@CurrentUserId() userId: string, @Query('limit') limit?: string) {
    return this.inspirationsService.getReviewQueue(userId, limit ? Number(limit) : undefined);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.inspirationsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    sourceUrl?: string | null;
    sourceType?: string;
    title?: string;
    description?: string;
    contentText?: string;
    coverImage?: string;
    author?: string;
    tags?: string[];
  }) {
    return this.inspirationsService.create({ ...data, userId });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @CurrentUserId() userId: string, @Body('status') status: string) {
    return this.inspirationsService.updateStatus(id, userId, status);
  }

  @Post(':id/reflections')
  addReflection(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body('body') body: string,
  ) {
    return this.inspirationsService.addReflection(id, userId, body || '');
  }

  @Patch(':id/review')
  applyReviewAction(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body('action') action: 'later' | 'digested',
  ) {
    return this.inspirationsService.applyReviewAction(id, userId, action);
  }

  @Post(':id/task')
  createTask(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { title?: string; description?: string; estimatedMinutes?: number; dueDate?: string | null },
  ) {
    return this.inspirationsService.createTaskFromInspiration(id, userId, data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: {
      title?: string | null;
      description?: string | null;
      contentText?: string | null;
      sourceUrl?: string | null;
      sourceType?: string;
      tags?: string[];
    },
  ) {
    return this.inspirationsService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.inspirationsService.remove(id, userId);
  }
}
