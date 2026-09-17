import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { configureHttpBodyParsing } from './http-body';
import { resolveCorsOrigins } from './cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  configureHttpBodyParsing(app);

  const origins = resolveCorsOrigins(process.env.CORS_ORIGIN);

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
