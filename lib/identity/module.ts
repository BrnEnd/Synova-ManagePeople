import { createHash } from 'node:crypto';
import type { StoredPassword } from '@/lib/identity/password';
import type { UserRole } from '@/lib/provisioning/module';

export type Identity = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  email: string;
  displayName: string;
  role: UserRole;
  mustChangePassword: boolean;
};

export type LoginUser = Identity & {
  passwordSalt: string;
  passwordHash: string;
};

export type LoginAttempt = {
  failures: number;
  windowStartedAt: Date;
  blockedUntil: Date | null;
};

export type IdentityRepository = {
  findLoginUser(tenantSlug: string, email: string): Promise<LoginUser | null>;
  findActiveIdentity(userId: string, tenantId: string): Promise<Identity | null>;
  getLoginAttempt(tenantSlug: string, key: string): Promise<LoginAttempt | null>;
  saveLoginAttempt(tenantSlug: string, key: string, attempt: LoginAttempt, now: Date): Promise<void>;
  clearLoginAttempt(tenantSlug: string, key: string): Promise<void>;
  markLoginSuccessful(identity: Identity, now: Date): Promise<void>;
  updatePassword(userId: string, tenantId: string, password: StoredPassword, now: Date): Promise<Identity>;
};

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super('Senha atual inválida.');
    this.name = 'InvalidCurrentPasswordError';
  }
}

type IdentityDependencies = {
  repository: IdentityRepository;
  verifyPassword: (password: string, stored: StoredPassword) => Promise<boolean>;
  hashPassword?: (password: string) => Promise<StoredPassword>;
  now: () => Date;
};

type AuthenticateCommand = {
  tenantSlug: string;
  email: string;
  password: string;
  ip: string;
};

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const DUMMY_PASSWORD: StoredPassword = {
  salt: 'invalid-user',
  hash: Buffer.alloc(64).toString('base64url'),
};

function attemptKey(tenantSlug: string, email: string, ip: string) {
  return createHash('sha256').update(`${tenantSlug}:${email}:${ip}`).digest('hex');
}

function safeIdentity(user: LoginUser): Identity {
  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export function createIdentityModule(dependencies: IdentityDependencies) {
  return {
    async resolveSession(session: { userId: string; tenantId: string }) {
      return dependencies.repository.findActiveIdentity(session.userId, session.tenantId);
    },

    async changePassword(command: { identity: Identity; currentPassword: string; newPassword: string }) {
      if (!dependencies.hashPassword) throw new Error('A função de hash de senha não foi configurada.');
      const user = await dependencies.repository.findLoginUser(command.identity.tenantSlug, command.identity.email);
      const valid = Boolean(user
        && user.id === command.identity.id
        && await dependencies.verifyPassword(command.currentPassword, {
          salt: user.passwordSalt,
          hash: user.passwordHash,
        }));
      if (!valid) throw new InvalidCurrentPasswordError();

      const stored = await dependencies.hashPassword(command.newPassword);
      return dependencies.repository.updatePassword(command.identity.id, command.identity.tenantId, stored, dependencies.now());
    },

    async authenticate(command: AuthenticateCommand) {
      const tenantSlug = command.tenantSlug.trim().toLowerCase();
      const email = command.email.trim().toLowerCase();
      const now = dependencies.now();
      const key = attemptKey(tenantSlug, email, command.ip);
      const attempt = await dependencies.repository.getLoginAttempt(tenantSlug, key);
      if (attempt?.blockedUntil && attempt.blockedUntil > now) {
        return { identity: null, rateLimited: true };
      }

      const user = await dependencies.repository.findLoginUser(tenantSlug, email);
      const valid = await dependencies.verifyPassword(
        command.password,
        user ? { salt: user.passwordSalt, hash: user.passwordHash } : DUMMY_PASSWORD,
      );

      if (!user || !valid) {
        const windowExpired = !attempt || now.getTime() - attempt.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;
        const failures = windowExpired ? 1 : attempt.failures + 1;
        await dependencies.repository.saveLoginAttempt(tenantSlug, key, {
          failures,
          windowStartedAt: windowExpired ? now : attempt.windowStartedAt,
          blockedUntil: failures >= LOGIN_MAX_FAILURES ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
        }, now);
        return { identity: null, rateLimited: false };
      }

      const identity = safeIdentity(user);
      await dependencies.repository.clearLoginAttempt(tenantSlug, key);
      await dependencies.repository.markLoginSuccessful(identity, now);
      return { identity, rateLimited: false };
    },
  };
}
