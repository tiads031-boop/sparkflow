import { Module } from '@nestjs/common';
import { AppUsageController } from './app-usage.controller';
import { AppUsageService } from './app-usage.service';

@Module({ controllers: [AppUsageController], providers: [AppUsageService] })
export class AppUsageModule {}
