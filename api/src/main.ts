import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigin = process.env.CORS_ORIGIN;
  const origins = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  // Ensure default user exists for single-user MVP
  const prisma = app.get(PrismaService);
  const defaultUserId = process.env.DEFAULT_USER_ID || 'default';
  await prisma.user.upsert({
    where: { id: defaultUserId },
    update: {},
    create: { id: defaultUserId, nickname: 'Default User' },
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`SparkFlow API running on http://localhost:${port}/api`);
  console.log(`CORS allowed origins: ${origins.join(', ')}`);
}
bootstrap();
