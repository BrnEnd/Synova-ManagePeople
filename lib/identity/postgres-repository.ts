import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { auditEvents, loginAttempts, tenants, users } from '@/lib/db/schema';
import type { Identity, IdentityRepository, LoginUser } from '@/lib/identity/module';

async function setTenant(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], tenantId: string) {
  await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
}

function mapIdentity(user: typeof users.$inferSelect, tenantSlug: string): Identity {
  return {
    id: user.id,
    tenantId: user.tenantId,
    tenantSlug,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

export class PostgresIdentityRepository implements IdentityRepository {
  async findLoginUser(tenantSlug: string, email: string): Promise<LoginUser | null> {
    const db = getDb();
    const [tenant] = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(and(
      eq(tenants.slug, tenantSlug),
      eq(tenants.status, 'active'),
    )).limit(1);
    if (!tenant) return null;

    return db.transaction(async (tx) => {
      await setTenant(tx, tenant.id);
      const [user] = await tx.select().from(users).where(and(
        eq(users.tenantId, tenant.id),
        eq(users.email, email),
        eq(users.status, 'active'),
      )).limit(1);
      if (!user) return null;
      return {
        ...mapIdentity(user, tenant.slug),
        passwordSalt: user.passwordSalt,
        passwordHash: user.passwordHash,
      };
    });
  }

  async findActiveIdentity(userId: string, tenantId: string) {
    const db = getDb();
    const [tenant] = await db.select({ id: tenants.id, slug: tenants.slug }).from(tenants).where(and(
      eq(tenants.id, tenantId),
      eq(tenants.status, 'active'),
    )).limit(1);
    if (!tenant) return null;

    return db.transaction(async (tx) => {
      await setTenant(tx, tenant.id);
      const [user] = await tx.select().from(users).where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenant.id),
        eq(users.status, 'active'),
      )).limit(1);
      return user ? mapIdentity(user, tenant.slug) : null;
    });
  }

  async getLoginAttempt(key: string) {
    const [attempt] = await getDb().select().from(loginAttempts).where(eq(loginAttempts.key, key)).limit(1);
    if (!attempt) return null;
    return {
      failures: attempt.failures,
      windowStartedAt: attempt.windowStartedAt,
      blockedUntil: attempt.blockedUntil,
    };
  }

  async saveLoginAttempt(key: string, attempt: Parameters<IdentityRepository['saveLoginAttempt']>[1], now: Date) {
    await getDb().insert(loginAttempts).values({
      key,
      ...attempt,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: loginAttempts.key,
      set: { ...attempt, updatedAt: now },
    });
  }

  async clearLoginAttempt(key: string) {
    await getDb().delete(loginAttempts).where(eq(loginAttempts.key, key));
  }

  async markLoginSuccessful(identity: Identity, now: Date) {
    await getDb().transaction(async (tx) => {
      await setTenant(tx, identity.tenantId);
      await tx.update(users).set({ lastLoginAt: now, updatedAt: now }).where(and(
        eq(users.id, identity.id),
        eq(users.tenantId, identity.tenantId),
      ));
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId: identity.tenantId,
        actorUserId: identity.id,
        eventType: 'user.logged_in',
        entityType: 'user',
        entityId: identity.id,
        occurredAt: now,
      });
    });
  }

  async updatePassword(userId: string, tenantId: string, password: { salt: string; hash: string }, now: Date) {
    return getDb().transaction(async (tx) => {
      await setTenant(tx, tenantId);
      const [tenant] = await tx.select({ slug: tenants.slug }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const [updated] = await tx.update(users).set({
        passwordSalt: password.salt,
        passwordHash: password.hash,
        mustChangePassword: false,
        updatedAt: now,
      }).where(and(eq(users.id, userId), eq(users.tenantId, tenantId), eq(users.status, 'active'))).returning();
      if (!tenant || !updated) throw new Error('Usuário não encontrado.');
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId,
        actorUserId: userId,
        eventType: 'user.password_changed',
        entityType: 'user',
        entityId: userId,
        occurredAt: now,
      });
      return mapIdentity(updated, tenant.slug);
    });
  }
}
