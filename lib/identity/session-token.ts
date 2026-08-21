import { SignJWT, jwtVerify } from 'jose';

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const ISSUER = 'synova-manage-people';
const AUDIENCE = 'synova-portal';

export type SessionIdentity = {
  userId: string;
  tenantId: string;
};

function key(secret: string) {
  if (secret.length < 32) throw new Error('SESSION_SECRET deve possuir ao menos 32 caracteres.');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(identity: SessionIdentity, secret: string, now = new Date()) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ tenantId: identity.tenantId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(identity.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_DURATION_SECONDS)
    .sign(key(secret));
}

export async function readSessionToken(token: string, secret: string, now = new Date()): Promise<SessionIdentity | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
    });
    if (typeof payload.sub !== 'string' || typeof payload.tenantId !== 'string') return null;
    return { userId: payload.sub, tenantId: payload.tenantId };
  } catch {
    return null;
  }
}
