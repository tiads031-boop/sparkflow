import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { InspirationsModule } from './inspirations/inspirations.module';
import { TasksModule } from './tasks/tasks.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { CalendarModule } from './calendar/calendar.module';
import { CourseModule } from './course/course.module';
import { ContextBridgeModule } from './context-bridge/context-bridge.module';
import { PushModule } from './push/push.module';
import { CommonModule } from './common/common.module';
import { ApiKeyGuard } from './common/guards/api-key.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    PrismaModule,
    UsersModule,
    InspirationsModule,
    TasksModule,
    PomodoroModule,
    CalendarModule,
    CourseModule,
    ContextBridgeModule,
    ScheduleModule.forRoot(),
    PushModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ApiKeyGuard,
    },
  ],
})
export class AppModule {}
