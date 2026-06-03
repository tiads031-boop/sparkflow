import { Controller, Get, Post, Put, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(
    @Query('userId') userId: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.tasksService.findAll(userId, status, date);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    estimatedMinutes?: number;
    tags?: string[];
    inspirationId?: string;
  }) {
    return this.tasksService.create(data);
  }

  @Put(':id')
  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Record<string, any>) {
    return this.tasksService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}
