import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseIntegrationsService } from './course-integrations.service';
import { CourseIntegrationsController } from './course-integrations.controller';

@Module({
  controllers: [CourseController, CourseIntegrationsController],
  providers: [CourseService, CourseIntegrationsService],
  exports: [CourseService],
})
export class CourseModule {}
