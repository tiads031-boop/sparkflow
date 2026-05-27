import { Module } from '@nestjs/common';
import { InspirationsController } from './inspirations.controller';
import { InspirationsService } from './inspirations.service';

@Module({
  controllers: [InspirationsController],
  providers: [InspirationsService],
})
export class InspirationsModule {}
