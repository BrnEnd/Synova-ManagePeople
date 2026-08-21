import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

export type StoredPassword = {
  salt: string;
  hash: string;
};

export async function hashPassword(password: string): Promise<StoredPassword> {
  const salt = randomBytes(16).toString('base64url');
  const derived = await scryptAsync(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString('base64url') };
}

export async function verifyPassword(password: string, stored: StoredPassword) {
  try {
    const derived = await scryptAsync(password, stored.salt, 64) as Buffer;
    const expected = Buffer.from(stored.hash, 'base64url');
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
