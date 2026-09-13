import { Module } from '@nestjs/common';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SessionAuthGuard],
  exports: [SessionAuthGuard],
})
export class CommonModule {}
