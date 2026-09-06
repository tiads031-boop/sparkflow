import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CourseIntegrationsService, type DavRequest } from './course-integrations.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
@Controller('course-integrations')
export class CourseIntegrationsController {
  constructor(private service: CourseIntegrationsService) {}
  @Get('holidays') holidays(@Query('year') year: string) { return this.service.holidays(Number(year)); }
  @Get('webdav') status() { return this.service.davStatus(); }
  @Post('webdav/read') read(@CurrentUserId() userId: string, @Body() data: DavRequest) {
    if (!userId || !data) throw new BadRequestException('缺少用户或连接配置');
    return this.service.readDav(userId, data);
  }
  @Post('webdav/write') write(@CurrentUserId() userId: string, @Body() data: DavRequest) {
    if (!userId || !data) throw new BadRequestException('缺少用户或连接配置');
    return this.service.writeDav(userId, data);
  }
}
