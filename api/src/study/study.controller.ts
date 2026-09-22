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
  progressType?: 'task' | 'numeric' | 'time';
  targetValue?: number | null;
  progressUnit?: string | null;
}

export interface GoalProgressEntryInput {
  value?: number;
  occurredAt?: string;
  note?: string | null;
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

  @Get(':id/progress')
  progress(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Query('weekStart') weekStart?: string,
    @Query('weekEnd') weekEnd?: string,
  ) {
    return this.studyService.progress(id, userId, weekStart, weekEnd);
  }

  @Post(':id/progress-entries')
  createProgressEntry(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() input: GoalProgressEntryInput,
  ) {
    return this.studyService.createProgressEntry(id, userId, input);
  }

  @Patch(':id/progress-entries/:entryId')
  updateProgressEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @CurrentUserId() userId: string,
    @Body() input: GoalProgressEntryInput,
  ) {
    return this.studyService.updateProgressEntry(id, entryId, userId, input);
  }

  @Delete(':id/progress-entries/:entryId')
  deleteProgressEntry(
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.studyService.deleteProgressEntry(id, entryId, userId);
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
