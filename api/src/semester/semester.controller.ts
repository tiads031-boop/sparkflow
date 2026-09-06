import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { SemesterService } from './semester.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('semesters')
export class SemesterController {
  constructor(private readonly semesterService: SemesterService) {}

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.semesterService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.semesterService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive?: boolean;
  }) {
    return this.semesterService.create({ ...data, userId });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: Record<string, any>,
  ) {
    return this.semesterService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.semesterService.remove(id, userId);
  }
}
