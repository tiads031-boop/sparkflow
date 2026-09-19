import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AudioTranscriptionService,
  validateAudioInput,
} from '../ai/audio-transcription.service';

export const validatePlanningAudio = validateAudioInput;

@Injectable()
export class VoiceTranscriptionService extends AudioTranscriptionService {
  constructor(config: ConfigService) {
    super(config);
  }
}
