import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findCurrent(@CurrentUserId() userId: string) {
    return this.usersService.findOne(userId);
  }
  @Get('preferences/time-tracking')
  getTimeTrackingPreferences(@CurrentUserId() userId: string) {
    return this.usersService.getTimeTrackingPreferences(userId);
  }

  @Patch('preferences/time-tracking')
  updateTimeTrackingPreferences(
    @CurrentUserId() userId: string,
    @Body() input: unknown,
  ) {
    return this.usersService.updateTimeTrackingPreferences(userId, input);
  }
}
