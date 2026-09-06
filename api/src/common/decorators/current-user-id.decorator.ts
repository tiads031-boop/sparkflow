import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    return context.switchToHttp().getRequest().authUserId;
  },
);
