import type { IdentityRepository, LoginAttempt, LoginUser } from '@/lib/identity/module';

export class InMemoryIdentityRepository implements IdentityRepository {
  private readonly attempts = new Map<string, LoginAttempt>();
  private readonly users: LoginUser[];

  constructor(users: LoginUser[]) {
    this.users = users.map((user) => ({ ...user }));
  }

  async findLoginUser(tenantSlug: string, email: string) {
    return this.users.find((user) => user.tenantSlug === tenantSlug && user.email === email) ?? null;
  }

  async findActiveIdentity(userId: string, tenantId: string) {
    const user = this.users.find((candidate) => candidate.id === userId && candidate.tenantId === tenantId);
    if (!user) return null;
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

  private attemptKey(tenantSlug: string, key: string) {
    return `${tenantSlug}:${key}`;
  }

  async getLoginAttempt(tenantSlug: string, key: string) {
    return this.attempts.get(this.attemptKey(tenantSlug, key)) ?? null;
  }

  async saveLoginAttempt(tenantSlug: string, key: string, attempt: LoginAttempt, now: Date) {
    void now;
    this.attempts.set(this.attemptKey(tenantSlug, key), attempt);
  }

  async clearLoginAttempt(tenantSlug: string, key: string) {
    this.attempts.delete(this.attemptKey(tenantSlug, key));
  }

  async markLoginSuccessful() {}

  async updatePassword(userId: string, tenantId: string, password: { salt: string; hash: string }) {
    const user = this.users.find((candidate) => candidate.id === userId && candidate.tenantId === tenantId);
    if (!user) throw new Error('Usuário não encontrado.');
    user.passwordSalt = password.salt;
    user.passwordHash = password.hash;
    user.mustChangePassword = false;
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
}
