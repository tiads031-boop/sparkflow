import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SemesterService } from './semester.service';

@Controller('semesters')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.semesterService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('userId') userId: string) {
    return this.semesterService.findOne(id, userId);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }) {
    return this.semesterService.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() data: Record<string, any>,
  ) {
    return this.semesterService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.semesterService.remove(id, userId);
  }
}
