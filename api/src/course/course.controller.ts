import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CourseService } from './course.service';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  // ==================== ICS 文件导入 ====================

  @Post('import-ics')
  @UseInterceptors(FileInterceptor('file'))
  async importIcs(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('semesterId') semesterId?: string,
    @Body('semesterStart') semesterStart?: string,
    @Body('semesterEnd') semesterEnd?: string,
    @Body('excludeCourses') excludeCourses?: string,
  ) {
    if (!file) throw new Error('请上传 .ics 文件');
    return this.courseService.importFromIcs(file.buffer, userId, {
      semesterId,
      semesterStart,
      semesterEnd,
      excludeCourses: excludeCourses ? excludeCourses.split(',').map((s) => s.trim()) : undefined,
    });
  }

  // ==================== Course CRUD ====================

  @Get()
  findAll(
    @Query('userId') userId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.courseService.findAll(userId, semesterId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('userId') userId: string) {
    return this.courseService.findOne(id, userId);
  }

  @Post()
  create(@Body() data: {
    userId: string;
    name: string;
    teacher?: string;
    room?: string;
    color?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    weeks?: number[];
    location?: string;
    icsUid?: string;
    semesterId?: string;
  }) {
    return this.courseService.create(data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Query('userId') userId: string,
    @Body() data: Record<string, any>,
  ) {
    return this.courseService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.courseService.remove(id, userId);
  }

  // ==================== 课程实例 (CalendarEvent) ====================

  @Get(':id/events')
  findEvents(@Param('id') id: string, @Query('userId') userId: string) {
    return this.courseService.findEvents(id, userId);
  }

  /** 调课：修改单个实例 */
  @Patch('events/:eventId')
  adjustEvent(
    @Param('eventId') eventId: string,
    @Query('userId') userId: string,
    @Body() data: { startTime?: string; endTime?: string; room?: string; title?: string },
  ) {
    return this.courseService.adjustEvent(eventId, userId, data);
  }

  // ==================== 课程笔记 ====================

  @Get(':id/notes')
  findNotes(@Param('id') id: string, @Query('userId') userId: string) {
    return this.courseService.findNotes(id, userId);
  }

  @Post('notes')
  createNote(@Body() data: { userId: string; courseId: string; body: string; pinned?: boolean }) {
    return this.courseService.createNote(data);
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('noteId') noteId: string,
    @Query('userId') userId: string,
    @Body() data: { body?: string; pinned?: boolean },
  ) {
    return this.courseService.updateNote(noteId, userId, data);
  }

  @Delete('notes/:noteId')
  deleteNote(@Param('noteId') noteId: string, @Query('userId') userId: string) {
    return this.courseService.deleteNote(noteId, userId);
  }
}
