import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { TagsService, type TagInput } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentUserId() userId: string, @Query('includeArchived') includeArchived?: string) {
    return this.tagsService.list(userId, includeArchived === 'true');
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() input: TagInput) {
    return this.tagsService.create(userId, input);
  }

  @Patch(':id')
  update(@CurrentUserId() userId: string, @Param('id') id: string, @Body() input: Partial<TagInput>) {
    return this.tagsService.update(userId, id, input);
  }

  @Delete(':id')
  archive(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.tagsService.archive(userId, id);
  }
}
