import { expect, test } from 'vitest';
import { createSessionToken, readSessionToken } from '@/lib/identity/session-token';

test('a sessão assinada preserva somente a identidade necessária', async () => {
  const secret = 'session-secret-with-at-least-32-characters';
  const token = await createSessionToken({
    userId: '07050f2f-4fef-47f0-b903-a873b7922e08',
    tenantId: '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
  }, secret, new Date('2026-08-20T12:00:00.000Z'));

  await expect(readSessionToken(token, secret, new Date('2026-08-20T13:00:00.000Z'))).resolves.toEqual({
    userId: '07050f2f-4fef-47f0-b903-a873b7922e08',
    tenantId: '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
  });
  await expect(readSessionToken(token, 'different-secret-with-at-least-32-chars', new Date('2026-08-20T13:00:00.000Z'))).resolves.toBeNull();
});
