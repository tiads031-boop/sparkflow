import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { InspirationsService } from './inspirations.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  InspirationMediaService,
  MAX_INSPIRATION_ATTACHMENTS,
  MAX_INSPIRATION_FILE_BYTES,
} from './inspiration-media.service';

function parseCaptureTags(raw?: string) {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('tags must be an array');
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 30);
  } catch {
    throw new BadRequestException('tags 格式无效');
  }
}

@Controller('inspirations')
export class InspirationsController {
  constructor(
    private readonly inspirationsService: InspirationsService,
    private readonly media: InspirationMediaService,
  ) {}

  @Get()
  findAll(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.inspirationsService.findAll(userId, status);
  }

  @Get('review/queue')
  getReviewQueue(@CurrentUserId() userId: string, @Query('limit') limit?: string) {
    return this.inspirationsService.getReviewQueue(userId, limit ? Number(limit) : undefined);
  }

  @Post('capture')
  @UseInterceptors(FilesInterceptor('files', MAX_INSPIRATION_ATTACHMENTS, {
    limits: {
      fileSize: MAX_INSPIRATION_FILE_BYTES,
      files: MAX_INSPIRATION_ATTACHMENTS,
    },
  }))
  capture(
    @CurrentUserId() userId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('contentText') contentText?: string,
    @Body('tags') tags?: string,
  ) {
    return this.inspirationsService.createCapture(
      userId,
      contentText,
      files || [],
      parseCaptureTags(tags),
    );
  }

  @Get(':id/attachments/:attachmentId/file')
  async attachmentFile(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserId() userId: string,
  ) {
    const attachment = await this.inspirationsService.getAttachment(
      id,
      attachmentId,
      userId,
    );
    return new StreamableFile(this.media.open(attachment.storageKey), {
      type: attachment.mimeType,
      length: attachment.sizeBytes,
      disposition: 'inline',
    });
  }

  @Post(':id/attachments/:attachmentId/transcribe')
  transcribeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.inspirationsService.transcribeAttachment(
      id,
      attachmentId,
      userId,
    );
  }

  @Post(':id/attachments/:attachmentId/summary')
  summarizeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.inspirationsService.summarizeAttachment(
      id,
      attachmentId,
      userId,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.inspirationsService.findOne(id, userId);
  }

  @Post()
  create(@CurrentUserId() userId: string, @Body() data: {
    userId?: string;
    sourceUrl?: string | null;
    sourceType?: string;
    title?: string;
    description?: string;
    contentText?: string;
    coverImage?: string;
    author?: string;
    tags?: string[];
  }) {
    return this.inspirationsService.create({ ...data, userId });
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @CurrentUserId() userId: string, @Body('status') status: string) {
    return this.inspirationsService.updateStatus(id, userId, status);
  }

  @Post(':id/reflections')
  addReflection(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body('body') body: string,
  ) {
    return this.inspirationsService.addReflection(id, userId, body || '');
  }

  @Patch(':id/review')
  applyReviewAction(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body('action') action: 'later' | 'digested',
  ) {
    return this.inspirationsService.applyReviewAction(id, userId, action);
  }

  @Post(':id/task')
  createTask(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: { title?: string; description?: string; estimatedMinutes?: number; dueDate?: string | null },
  ) {
    return this.inspirationsService.createTaskFromInspiration(id, userId, data);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUserId() userId: string,
    @Body() data: {
      title?: string | null;
      description?: string | null;
      contentText?: string | null;
      sourceUrl?: string | null;
      sourceType?: string;
      tags?: string[];
    },
  ) {
    return this.inspirationsService.update(id, userId, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.inspirationsService.remove(id, userId);
  }
}
