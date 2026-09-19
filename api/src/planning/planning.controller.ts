import { Body, Controller, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PlanningService } from './planning.service';
import { VoiceTranscriptionService } from './voice-transcription.service';

@Controller('planning')
export class PlanningController {
  constructor(
    private readonly planningService: PlanningService,
    private readonly voiceTranscription: VoiceTranscriptionService,
  ) {}

  @Get('voice/status')
  voiceStatus() {
    return this.voiceTranscription.status();
  }

  @Post('voice/transcribe')
  @UseInterceptors(FileInterceptor('audio', {
    limits: { fileSize: 7 * 1024 * 1024, files: 1 },
  }))
  transcribe(
    @CurrentUserId() _userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.voiceTranscription.transcribe(file);
  }

  @Get('threads')
  list(
    @CurrentUserId() userId: string,
    @Query('status') status?: string,
    @Query('scopeType') scopeType?: string,
    @Query('scopeId') scopeId?: string,
  ) {
    return this.planningService.listThreads(
      userId,
      status || 'active',
      scopeType,
      scopeId,
    );
  }

  @Post('threads')
  create(
    @CurrentUserId() userId: string,
    @Body() data: { title?: string; scopeType?: string; scopeId?: string },
  ) {
    return this.planningService.createThread(userId, data || {});
  }

  @Get('threads/:id')
  get(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.planningService.getThread(userId, id);
  }

  @Patch('threads/:id/context')
  updateContext(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() data: {
      expectedRevision: number;
      title?: string | null;
      brief?: unknown;
      constraints?: unknown;
      preferences?: unknown;
      strategy?: unknown;
      assumptions?: unknown;
    },
  ) {
    return this.planningService.updateContext(userId, id, data);
  }

  @Post('threads/:id/turn')
  turn(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() data: {
      message: string;
      expectedRevision: number;
      currentTime?: string;
      timeZone?: string;
    },
  ) {
    return this.planningService.turn(userId, id, data);
  }

  @Post('threads/:id/actions/apply')
  applyActions(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() data: { conversationId: string; proposalIds: string[] },
  ) {
    return this.planningService.applyActions(userId, id, data);
  }

  @Post('threads/:id/close')
  close(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.planningService.closeThread(userId, id);
  }
}
