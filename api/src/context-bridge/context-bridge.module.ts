import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ContextBridgeController } from './context-bridge.controller';
import { ContextBridgeService } from './context-bridge.service';

@Module({
  imports: [PrismaModule],
  controllers: [ContextBridgeController],
  providers: [ContextBridgeService],
  exports: [ContextBridgeService],
})
export class ContextBridgeModule {}
