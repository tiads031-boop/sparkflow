import { Module } from '@nestjs/common';
import { ContextBridgeController } from './context-bridge.controller';
import { ContextBridgeService } from './context-bridge.service';

@Module({
  controllers: [ContextBridgeController],
  providers: [ContextBridgeService],
  exports: [ContextBridgeService],
})
export class ContextBridgeModule {}
