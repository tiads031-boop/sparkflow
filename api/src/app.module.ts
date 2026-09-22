import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { InspirationsModule } from './inspirations/inspirations.module';
import { InsightsModule } from './insights/insights.module';
import { TasksModule } from './tasks/tasks.module';
import { PomodoroModule } from './pomodoro/pomodoro.module';
import { PlannerModule } from './planner/planner.module';
import { CalendarModule } from './calendar/calendar.module';
import { CourseModule } from './course/course.module';
import { SemesterModule } from './semester/semester.module';
import { PushModule } from './push/push.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { CommonModule } from './common/common.module';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { StudyModule } from './study/study.module';
import { PlanningModule } from './planning/planning.module';
import { TagsModule } from './tags/tags.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ScenesModule } from './scenes/scenes.module';
import { AppUsageModule } from './app-usage/app-usage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CommonModule,
    AuthModule,
    PrismaModule,
    UsersModule,
    InspirationsModule,
    InsightsModule,
    TasksModule,
    PomodoroModule,
    PlannerModule,
    CalendarModule,
    CourseModule,
    SemesterModule,
    ScheduleModule.forRoot(),
    PushModule,
    GoogleCalendarModule,
    StudyModule,
    PlanningModule,
    TagsModule,
    AnalyticsModule,
    ScenesModule,
    AppUsageModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
  ],
})
export class AppModule {}
