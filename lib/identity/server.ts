import 'server-only';
import { cookies } from 'next/headers';
import type { Identity } from '@/lib/identity/module';
import { createIdentityModule } from '@/lib/identity/module';
import { hashPassword, verifyPassword } from '@/lib/identity/password';
import { PostgresIdentityRepository } from '@/lib/identity/postgres-repository';
import { createSessionToken, readSessionToken } from '@/lib/identity/session-token';
import { PORTAL_BASE_PATH } from '@/lib/routing/base-path';

const SESSION_COOKIE = 'synova_people_session';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export function getIdentityModule() {
  return createIdentityModule({
    repository: new PostgresIdentityRepository(),
    verifyPassword,
    hashPassword,
    now: () => new Date(),
  });
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET não configurado.');
  return secret;
}

export async function createBrowserSession(identity: Identity) {
  const now = new Date();
  const token = await createSessionToken({ userId: identity.id, tenantId: identity.tenantId }, sessionSecret(), now);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: PORTAL_BASE_PATH,
    expires: new Date(now.getTime() + SESSION_DURATION_MS),
    priority: 'high',
  });
}

export async function deleteBrowserSession() {
  (await cookies()).set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: PORTAL_BASE_PATH,
    expires: new Date(0),
    priority: 'high',
  });
}

export async function getCurrentIdentity() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await readSessionToken(token, sessionSecret());
  if (!session) return null;
  return getIdentityModule().resolveSession(session);
}

export function requestIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}
