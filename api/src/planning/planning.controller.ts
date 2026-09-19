import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly planningService: PlanningService) {}

  @Get('threads')
  list(@CurrentUserId() userId: string, @Query('status') status?: string) {
    return this.planningService.listThreads(userId, status || 'active');
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
    @Body() data: { message: string; expectedRevision: number },
  ) {
    return this.planningService.turn(userId, id, data);
  }

  @Post('threads/:id/close')
  close(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.planningService.closeThread(userId, id);
  }
}
