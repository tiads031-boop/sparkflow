import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const originalBuildSha = process.env.BUILD_SHA;

  beforeEach(async () => {
    delete process.env.BUILD_SHA;
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterAll(() => {
    if (originalBuildSha === undefined) delete process.env.BUILD_SHA;
    else process.env.BUILD_SHA = originalBuildSha;
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return a healthy service response with a safe fallback build SHA', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'sparkflow-api',
        buildSha: 'unknown',
        timestamp: expect.any(String),
      });
    });

    it('should expose the deployed build SHA when provided', () => {
      process.env.BUILD_SHA = '2ffbf4480ec9eaab1032fae71ae573b56bf1c2c9';
      expect(appController.getHealth()).toMatchObject({
        status: 'ok',
        service: 'sparkflow-api',
        buildSha: '2ffbf4480ec9eaab1032fae71ae573b56bf1c2c9',
      });
    });
  });
});
