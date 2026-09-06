import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findCurrent(@CurrentUserId() userId: string) {
    return this.usersService.findOne(userId);
  }
}
