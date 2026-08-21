import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { auditEvents, idempotencyRecords, tenants, users } from '@/lib/db/schema';
import type { ProvisioningRepository, Tenant, User } from '@/lib/provisioning/module';

const TENANT_SCOPE = 'tenant:create';

function mapTenant(row: typeof tenants.$inferSelect): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function mapUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
  };
}

async function lockIdempotency(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], scope: string, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))`);
}

async function setTenant(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0], tenantId: string) {
  await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
}

async function enableProvisioning(tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]) {
  await tx.execute(sql`select set_config('app.provisioning', 'on', true)`);
}

export class PostgresProvisioningRepository implements ProvisioningRepository {
  async createTenantIdempotently(input: Parameters<ProvisioningRepository['createTenantIdempotently']>[0]) {
    return getDb().transaction(async (tx) => {
      await enableProvisioning(tx);
      await lockIdempotency(tx, TENANT_SCOPE, input.idempotencyKey);
      const [existing] = await tx.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.scope, TENANT_SCOPE),
        eq(idempotencyRecords.key, input.idempotencyKey),
      )).limit(1);

      if (existing) {
        const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, existing.resourceId)).limit(1);
        if (!tenant) throw new Error('Tenant do registro idempotente não encontrado.');
        return { tenant: mapTenant(tenant), replayed: true, requestHash: existing.requestHash };
      }

      await setTenant(tx, input.tenant.id);
      const [created] = await tx.insert(tenants).values({
        ...input.tenant,
        updatedAt: input.tenant.createdAt,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId: created.id,
        eventType: 'tenant.created',
        entityType: 'tenant',
        entityId: created.id,
        metadata: { slug: created.slug },
        occurredAt: input.tenant.createdAt,
      });
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(),
        tenantId: created.id,
        scope: TENANT_SCOPE,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: created.id,
        responseStatus: 201,
        createdAt: input.tenant.createdAt,
      });
      return { tenant: mapTenant(created), replayed: false, requestHash: input.requestHash };
    });
  }

  async createUserIdempotently(input: Parameters<ProvisioningRepository['createUserIdempotently']>[0]) {
    const scope = `tenant:${input.user.tenantId}:user:create`;
    return getDb().transaction(async (tx) => {
      await enableProvisioning(tx);
      await setTenant(tx, input.user.tenantId);
      await lockIdempotency(tx, scope, input.idempotencyKey);
      const [existing] = await tx.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, input.idempotencyKey),
      )).limit(1);

      if (existing) {
        const [user] = await tx.select().from(users).where(eq(users.id, existing.resourceId)).limit(1);
        if (!user) throw new Error('Usuário do registro idempotente não encontrado.');
        return { user: mapUser(user), replayed: true, requestHash: existing.requestHash };
      }

      const [created] = await tx.insert(users).values({
        ...input.user,
        passwordSalt: input.credentials.passwordSalt,
        passwordHash: input.credentials.passwordHash,
        updatedAt: input.user.createdAt,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId: created.tenantId,
        eventType: 'user.created',
        entityType: 'user',
        entityId: created.id,
        metadata: { email: created.email, role: created.role },
        occurredAt: input.user.createdAt,
      });
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(),
        tenantId: created.tenantId,
        scope,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: created.id,
        responseStatus: 201,
        createdAt: input.user.createdAt,
      });
      return { user: mapUser(created), replayed: false, requestHash: input.requestHash };
    });
  }

  async resetPasswordIdempotently(input: Parameters<ProvisioningRepository['resetPasswordIdempotently']>[0]) {
    const scope = `tenant:${input.tenantId}:user:password:reset`;
    return getDb().transaction(async (tx) => {
      await enableProvisioning(tx);
      await setTenant(tx, input.tenantId);
      await lockIdempotency(tx, scope, input.idempotencyKey);
      const [existing] = await tx.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, input.idempotencyKey),
      )).limit(1);
      if (existing) {
        const [user] = await tx.select().from(users).where(and(
          eq(users.id, existing.resourceId),
          eq(users.tenantId, input.tenantId),
        )).limit(1);
        if (!user) throw new Error('Usuário do registro idempotente não encontrado.');
        return { user: mapUser(user), replayed: true, requestHash: existing.requestHash };
      }

      const [updated] = await tx.update(users).set({
        passwordSalt: input.credentials.passwordSalt,
        passwordHash: input.credentials.passwordHash,
        mustChangePassword: true,
        updatedAt: input.changedAt,
      }).where(and(eq(users.id, input.userId), eq(users.tenantId, input.tenantId))).returning();
      if (!updated) throw new Error('Usuário não encontrado.');
      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId: input.tenantId,
        eventType: 'user.password_reset',
        entityType: 'user',
        entityId: input.userId,
        occurredAt: input.changedAt,
      });
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(),
        tenantId: input.tenantId,
        scope,
        key: input.idempotencyKey,
        requestHash: input.requestHash,
        resourceId: input.userId,
        responseStatus: 200,
        createdAt: input.changedAt,
      });
      return { user: mapUser(updated), replayed: false, requestHash: input.requestHash };
    });
  }
}
