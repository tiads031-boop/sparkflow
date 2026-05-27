import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { PomodoroService } from './pomodoro.service';

@Controller('pomodoro')
export class PomodoroController {
  constructor(private readonly pomodoroService: PomodoroService) {}

  @Get()
  findAll(@Query('userId') userId: string, @Query('date') date?: string) {
    return this.pomodoroService.findAll(userId, date);
  }

  @Get('stats')
  getStats(@Query('userId') userId: string) {
    return this.pomodoroService.getStats(userId);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    taskId?: string;
    duration?: number;
    notes?: string;
  }) {
    return this.pomodoroService.create(data);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.pomodoroService.complete(id);
  }

  @Post(':id/interrupt')
  interrupt(@Param('id') id: string) {
    return this.pomodoroService.interrupt(id);
  }
}
