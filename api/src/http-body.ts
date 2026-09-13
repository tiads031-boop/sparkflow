import type { INestApplication } from '@nestjs/common';
import { json, urlencoded } from 'express';

export function configureHttpBodyParsing(app: INestApplication) {
  app.use('/api/courses/import-json', json({ limit: '8mb' }));
  app.use(json());
  app.use(urlencoded({ extended: true }));
}
