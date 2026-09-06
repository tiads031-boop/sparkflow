import { BadRequestException, Controller, Get, Post, Patch, Delete, Body, Param, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CourseService } from './course.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Get('backup')
  exportSchedule(@CurrentUserId() userId: string, @Query('semesterId') semesterId?: string) {
    if (!userId) throw new BadRequestException('缺少用户标识');
    return this.courseService.exportSchedule(userId, semesterId);
  }

  @Post('import-json')
  importSchedule(@CurrentUserId() userId: string, @Body() body: unknown) {
    if (!userId) throw new BadRequestException('缺少用户标识');
    return this.courseService.importSchedule(userId, body);
  }

  // ==================== ICS 文件导入 ====================

  @Post('import-ics')
  @UseInterceptors(FileInterceptor('file'))
  async importIcs(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUserId() userId: string,
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
    @CurrentUserId() userId: string,
    @Query('semesterId') semesterId?: string,
  ) {
    return this.courseService.findAll(userId, semesterId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.courseService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
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
    return this.courseService.create({ ...data, userId });
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: Record<string, any>,
  ) {
    return this.courseService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.courseService.remove(id, userId);
  }

  // ==================== 课程实例 (CalendarEvent) ====================

  @Get(':id/events')
  findEvents(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.courseService.findEvents(id, userId);
  }

  /** 调课：修改单个实例 */
  @Patch('events/:eventId')
  adjustEvent(
    @Param('eventId') eventId: string,
    @CurrentUserId() userId: string,
    @Body() data: { startTime?: string; endTime?: string; room?: string; title?: string },
  ) {
    return this.courseService.adjustEvent(eventId, userId, data);
  }

  // ==================== 课程任务（兼容既有 notes 路径） ====================

  @Get(':id/notes')
  findNotes(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.courseService.findNotes(id, userId);
  }

  @Post('notes')
  createNote(@CurrentUserId() userId: string, @Body() data: { userId?: string; courseId: string; body: string; pinned?: boolean }) {
    return this.courseService.createNote({ ...data, userId });
  }

  @Patch('notes/:noteId')
  updateNote(
    @Param('noteId') noteId: string,
    @CurrentUserId() userId: string,
    @Body() data: { body?: string; pinned?: boolean },
  ) {
    return this.courseService.updateNote(noteId, userId, data);
  }

  @Delete('notes/:noteId')
  deleteNote(@Param('noteId') noteId: string, @CurrentUserId() userId: string) {
    return this.courseService.deleteNote(noteId, userId);
  }
}
