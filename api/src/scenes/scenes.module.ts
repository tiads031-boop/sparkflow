import { Module } from '@nestjs/common';
import { ScenesController } from './scenes.controller';
import { ScenesService } from './scenes.service';
import { SceneAnalyticsService } from './scene-analytics.service';

@Module({
  controllers: [ScenesController],
  providers: [ScenesService, SceneAnalyticsService],
  exports: [ScenesService],
})
export class ScenesModule {}
