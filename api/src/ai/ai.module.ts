import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER } from './ai-provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { AudioTranscriptionService } from './audio-transcription.service';

@Module({
  providers: [
    AudioTranscriptionService,
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OpenAICompatibleProvider(config),
    },
  ],
  exports: [AI_PROVIDER, AudioTranscriptionService],
})
export class AiModule {}
