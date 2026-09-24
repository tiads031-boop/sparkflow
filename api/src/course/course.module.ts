import { Module } from '@nestjs/common';
import { CourseController } from './course.controller';
import { CourseService } from './course.service';
import { CourseIntegrationsService } from './course-integrations.service';
import { CourseIntegrationsController } from './course-integrations.controller';
import { CourseNoteImagesService } from './course-note-images.service';
import { InspirationMediaService } from '../inspirations/inspiration-media.service';

@Module({
  controllers: [CourseController, CourseIntegrationsController],
  providers: [CourseService, CourseIntegrationsService, CourseNoteImagesService, InspirationMediaService],
  exports: [CourseService, CourseIntegrationsService],
})
export class CourseModule {}
