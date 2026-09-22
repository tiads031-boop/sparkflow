import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PlanningController } from './planning.controller';
import { ResearchModule } from '../research/research.module';
import { PlanningService } from './planning.service';
import { VoiceTranscriptionService } from './voice-transcription.service';
import { CourseModule } from '../course/course.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AiModule, ResearchModule, CourseModule, AnalyticsModule],
  controllers: [PlanningController],
  providers: [PlanningService, VoiceTranscriptionService],
  exports: [PlanningService, VoiceTranscriptionService],
})
export class PlanningModule {}
