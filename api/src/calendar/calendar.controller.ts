import { Controller, Get, Post, Body, Param, Query, Patch, Delete } from '@nestjs/common';
import { CalendarService } from './calendar.service';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  findAll(
    @Query('userId') userId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.calendarService.findAll(userId, start, end, semesterId);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    title: string;
    startTime: string;
    endTime: string;
    eventType?: string;
    taskId?: string;
    isAllDay?: boolean;
    color?: string;
    location?: string;
    externalSource?: string;
    externalEventId?: string;
    sourceCalendarTitle?: string;
  }) {
    return this.calendarService.create(data);
  }

  @Post('import-local')
  importLocal(@Body() data: {
    userId: string;
    platform?: string;
    source?: string;
    events: Array<{
      externalEventId: string;
      title: string;
      startTime: string;
      endTime: string;
      isAllDay?: boolean;
      eventType?: string;
      sourceCalendarTitle?: string;
      location?: string;
      description?: string;
      color?: string;
    }>;
  }) {
    return this.calendarService.importLocal(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Record<string, any>) {
    return this.calendarService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.calendarService.remove(id);
  }
}
