import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { InspirationsService } from './inspirations.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('inspirations')
export class InspirationsController {
  constructor(private readonly inspirationsService: InspirationsService) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.inspirationsService.findAll(userId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.inspirationsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    sourceUrl: string;
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
}
