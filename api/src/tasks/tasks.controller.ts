import { Controller, Get, Post, Put, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.tasksService.findAll(userId, status, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.tasksService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    estimatedMinutes?: number;
    tags?: string[];
    inspirationId?: string;
  }) {
    return this.tasksService.create({ ...data, userId });
  }

  @Put(':id')
  @Patch(':id')
  update(@Param('id') id: string, @CurrentUserId() userId: string, @Body() data: Record<string, any>) {
    return this.tasksService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.tasksService.remove(id, userId);
  }
}
