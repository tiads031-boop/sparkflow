import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [InsightsController],
  providers: [InsightsService],
})
export class InsightsModule {}
