import { Module } from '@nestjs/common';
import { InspirationsController } from './inspirations.controller';
import { InspirationsService } from './inspirations.service';
import { InspirationMediaService } from './inspiration-media.service';

@Module({
  controllers: [InspirationsController],
  providers: [InspirationsService, InspirationMediaService],
})
export class InspirationsModule {}
