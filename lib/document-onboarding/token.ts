import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function onboardingTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function createOnboardingToken(tenantId: string, requestId: string) {
  const token = `${tenantId}.${requestId}.${randomBytes(32).toString('base64url')}`;
  return { token, tokenHash: onboardingTokenHash(token) };
}

export function parseOnboardingToken(token: string) {
  const [tenantId, requestId, secret, extra] = token.split('.');
  if (extra || !UUID_PATTERN.test(tenantId ?? '') || !UUID_PATTERN.test(requestId ?? '') || !secret || secret.length < 32) return null;
  return { tenantId, requestId };
}

export function onboardingTokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(onboardingTokenHash(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
