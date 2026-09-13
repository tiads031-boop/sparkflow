import { Body, Controller, INestApplication, Post, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { CredentialsDto } from './auth/dto/auth.dto';
import { configureHttpBodyParsing } from './http-body';

@Controller('auth-test')
class AuthBodyController {
  @Post('register')
  register(@Body() dto: CredentialsDto) {
    return dto;
  }
}

describe('configureHttpBodyParsing', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthBodyController],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpBodyParsing(app);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('parses JSON credentials before validation', async () => {
    const credentials = {
      method: 'nickname',
      identifier: 'diagnostic_0914',
      password: 'Test123456!',
    };

    await request(app.getHttpServer())
      .post('/auth-test/register')
      .send(credentials)
      .expect(201)
      .expect(credentials);
  });
});
