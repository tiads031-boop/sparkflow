import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai-provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OpenAICompatibleProvider(config),
    },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
