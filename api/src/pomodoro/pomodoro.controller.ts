import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PomodoroService } from './pomodoro.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('date') date?: string) {
    return this.pomodoroService.findAll(userId, date);
  }

  @Get('stats')
  getStats(@CurrentUserId() userId: string) {
    return this.pomodoroService.getStats(userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    taskId?: string;
    duration?: number;
    notes?: string;
  }) {
    return this.pomodoroService.create({ ...data, userId });
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.pomodoroService.complete(id, userId);
  }

  @Post(':id/interrupt')
  interrupt(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.pomodoroService.interrupt(id, userId);
  }
}
