import { Module } from '@nestjs/common';
import { GoogleCalendarController } from './google-calendar.controller';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleAuthService } from './google-auth.service';
import { GoogleSyncService } from './google-sync.service';

@Module({
  controllers: [GoogleCalendarController],
  providers: [
    GoogleAuthService,
    GoogleCalendarService,
    GoogleSyncService,
  ],
  exports: [GoogleCalendarService, GoogleSyncService],
})
export class GoogleCalendarModule {}
