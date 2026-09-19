import { Body, Controller, Param, Post } from '@nestjs/common';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { PlannerService } from './planner.service';
import type { PlannerProposal } from './planner.scheduler';

@Controller('planner')
export class PlannerController {
  constructor(private readonly plannerService: PlannerService) {}

  @Post('preview')
  preview(
    @CurrentUserId() userId: string,
    @Body() data: { availabilityStart: string; availabilityEnd: string },
  ) {
    return this.plannerService.preview(userId, data);
  }

  @Post('apply')
  apply(
    @CurrentUserId() userId: string,
    @Body() data: {
      proposals: PlannerProposal[];
      planningThreadId?: string;
      planningThreadRevision?: number;
    },
  ) {
    return this.plannerService.apply(userId, data);
  }

  @Post(':planId/undo')
  undo(@CurrentUserId() userId: string, @Param('planId') planId: string) {
    return this.plannerService.undo(userId, planId);
  }
}
