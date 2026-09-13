import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const COST = 32768;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      KEY_LENGTH,
      { N: COST, r: BLOCK_SIZE, p: PARALLELIZATION, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${COST}$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, cost, saltHex, keyHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || Number(cost) !== COST || !saltHex || !keyHex) return false;
  try {
    const expected = Buffer.from(keyHex, 'hex');
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, Buffer.from(saltHex, 'hex'));
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
