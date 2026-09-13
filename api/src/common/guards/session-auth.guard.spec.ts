import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { SessionAuthGuard } from './session-auth.guard';

function contextFor(request: Record<string, any>) {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('SessionAuthGuard', () => {
  const reflector = { getAllAndOverride: jest.fn(() => false) } as any;

  it('rejects requests without a bearer token', async () => {
    const prisma = { authSession: { findUnique: jest.fn() } } as any;
    const guard = new SessionAuthGuard(reflector, prisma);
    await expect(guard.canActivate(contextFor({ method: 'GET', headers: {} })))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('uses only the server-side session owner as request identity', async () => {
    const prisma = {
      authSession: {
        findUnique: jest.fn(async () => ({
          userId: 'server-user-a',
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null,
          user: { email: 'fish@example.com' },
        })),
      },
    } as any;
    const request = {
      method: 'POST',
      headers: { authorization: 'Bearer random-session-token' },
      body: { userId: 'spoofed-user-b' },
    };
    const guard = new SessionAuthGuard(reflector, prisma);

    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(request).toMatchObject({ authUserId: 'server-user-a', authUserEmail: 'fish@example.com' });
    expect(prisma.authSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tokenHash: createHash('sha256').update('random-session-token').digest('hex') },
    }));
  });
});
