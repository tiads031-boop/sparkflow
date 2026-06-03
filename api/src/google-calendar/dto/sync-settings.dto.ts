import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SyncSettingsDto {
  @IsString()
  @IsOptional()
  calendarId?: string;

  @IsBoolean()
  @IsOptional()
  syncTasks?: boolean;

  @IsBoolean()
  @IsOptional()
  syncCourses?: boolean;

  @IsBoolean()
  @IsOptional()
  syncManual?: boolean;
}

export class SyncStatusDto {
  connected: boolean;
  googleEmail?: string;
  lastSyncAt?: Date;
  syncedEventCount: number;
  pendingEventCount: number;
  conflictEventCount: number;
  isSyncing: boolean;
}
