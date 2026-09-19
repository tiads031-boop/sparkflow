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
import { StudyService } from './study.service';

export interface StudyFolderInput {
  name?: string;
  description?: string | null;
  icon?: string;
  color?: string;
  courseIds?: string[];
  taskIds?: string[];
}

@Controller('study/folders')
export class StudyController {
  constructor(private readonly studyService: StudyService) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.studyService.findAll(userId, status);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.studyService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() input: StudyFolderInput) {
    return this.studyService.create(userId, input);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() input: StudyFolderInput,
  ) {
    return this.studyService.update(id, userId, input);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.studyService.setStatus(id, userId, 'archived');
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.studyService.setStatus(id, userId, 'active');
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.studyService.remove(id, userId);
  }
}
