import { Module } from '@nestjs/common';
import { InspirationsController } from './inspirations.controller';
import { InspirationsService } from './inspirations.service';
import { InspirationMediaService } from './inspiration-media.service';
import { MediaUnderstandingService } from './media-understanding.service';
import { PlanningModule } from '../planning/planning.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PlanningModule, AiModule],
  controllers: [InspirationsController],
  providers: [InspirationsService, InspirationMediaService, MediaUnderstandingService],
})
export class InspirationsModule {}
