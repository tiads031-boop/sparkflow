import { Controller, Get, Post, Body, Param, Query, Patch } from '@nestjs/common';
import { InspirationsService } from './inspirations.service';

@Controller('inspirations')
export class InspirationsController {
  constructor(private readonly inspirationsService: InspirationsService) {}

  @Get()
  findAll(@Query('userId') userId: string, @Query('status') status?: string) {
    return this.inspirationsService.findAll(userId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inspirationsService.findOne(id);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    sourceUrl: string;
    sourceType?: string;
    title?: string;
    description?: string;
    contentText?: string;
    coverImage?: string;
    author?: string;
    tags?: string[];
  }) {
    return this.inspirationsService.create(data);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.inspirationsService.updateStatus(id, status);
  }
}
