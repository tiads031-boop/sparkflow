import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function contextFor(request: Record<string, any>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('SupabaseAuthGuard', () => {
  const config = {
    get: jest.fn((key: string) => ({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
      NODE_ENV: 'production',
    })[key]),
  } as any;
  const reflector = { getAllAndOverride: jest.fn(() => false) } as any;
  const prisma = { user: { upsert: jest.fn(async () => ({})) } } as any;

  afterEach(() => jest.restoreAllMocks());

  it('rejects requests without a bearer token', async () => {
    const guard = new SupabaseAuthGuard(config, reflector, prisma);
    await expect(guard.canActivate(contextFor({ method: 'GET', headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses the verified token subject as the only request identity', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      id: 'auth-user-a',
      email: 'a@example.com',
    }), { status: 200 }));
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer valid-token' },
      body: { userId: 'spoofed-user-b' },
    };
    const guard = new SupabaseAuthGuard(config, reflector, prisma);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ authUserId: 'auth-user-a' });
    expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'auth-user-a' },
    }));
  });
});
