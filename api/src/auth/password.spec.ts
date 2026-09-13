import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('uses a random salt and verifies only the original password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toEqual(second);
    await expect(verifyPassword('correct horse battery staple', first)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', first)).resolves.toBe(false);
  });

  it('rejects malformed hashes', async () => {
    await expect(verifyPassword('password', 'not-a-valid-hash')).resolves.toBe(false);
  });
});
