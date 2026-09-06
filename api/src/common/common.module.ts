import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [SupabaseAuthGuard],
  exports: [SupabaseAuthGuard],
})
export class CommonModule {}
