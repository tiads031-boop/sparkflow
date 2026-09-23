import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
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

  @Get('active')
  findActive(@CurrentUserId() userId: string) {
    return this.pomodoroService.findActive(userId);
  }

  @Get('timeline')
  timeline(
    @CurrentUserId() userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.pomodoroService.findTimeline(userId, start, end);
  }

  @Post()
  create(
    @CurrentUserId() userId: string,
    @Body()
    data: {
      userId?: string;
      taskId?: string;
      title?: string;
      duration?: number;
      focusMode?: 'countdown' | 'countup';
      notes?: string;
      clientRequestId?: string;
    },
  ) {
    return this.pomodoroService.create({ ...data, userId });
  }

  @Post('manual')
  createManual(
    @CurrentUserId() userId: string,
    @Body()
    data: {
      title?: string;
      taskId?: string;
      startedAt: string;
      endedAt: string;
      notes?: string;
      tags?: string[];
      clientRequestId?: string;
    },
  ) {
    return this.pomodoroService.createManual({ ...data, userId });
  }

  @Patch(':id/manual')
  updateManual(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body()
    data: {
      expectedRevision: number;
      title?: string;
      taskId?: string | null;
      startedAt: string;
      endedAt: string;
      notes?: string;
      tags?: string[];
    },
  ) {
    return this.pomodoroService.updateManual(id, userId, data);
  }

  @Patch(':id/focus')
  updateFocus(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { title?: string; notes?: string; taskId?: string | null; tags?: string[] },
  ) {
    return this.pomodoroService.updateFocus(id, userId, data);
  }

  @Post(':id/pause')
  pause(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { revision?: number } = {},
  ) {
    return this.pomodoroService.pause(id, userId, data.revision);
  }

  @Post(':id/resume')
  resume(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { revision?: number } = {},
  ) {
    return this.pomodoroService.resume(id, userId, data.revision);
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { revision?: number } = {},
  ) {
    return this.pomodoroService.complete(id, userId, data.revision);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.pomodoroService.remove(id, userId);
  }

  @Post(':id/interrupt')
  interrupt(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { revision?: number } = {},
  ) {
    return this.pomodoroService.interrupt(id, userId, data.revision);
  }
}
