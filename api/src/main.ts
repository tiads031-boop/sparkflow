import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use('/api/courses/import-json', json({ limit: '8mb' }));

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

  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`SparkFlow API running on http://localhost:${port}/api`);
  console.log(`CORS allowed origins: ${origins.join(', ')}`);
}
bootstrap();
