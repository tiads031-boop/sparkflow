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
import { SemesterModule } from './semester/semester.module';
import { PushModule } from './push/push.module';
import { GoogleCalendarModule } from './google-calendar/google-calendar.module';
import { CommonModule } from './common/common.module';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';

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
    SemesterModule,
    ScheduleModule.forRoot(),
    PushModule,
    GoogleCalendarModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
  ],
})
export class AppModule {}
