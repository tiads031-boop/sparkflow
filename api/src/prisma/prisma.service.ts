import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

@Injectable()
export class PrismaService
  extends PrismaClient<{ adapter: typeof adapter }>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter });
  }

  async onModuleInit() {
    // Prisma v7 with driver adapters doesn't require $connect
    // Connection is managed by the pg Pool
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
