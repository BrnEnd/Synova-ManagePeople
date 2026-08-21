import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, ne, sql } from 'drizzle-orm';
import { auditEvents, employees, idempotencyRecords, serviceKeys, tenants, users } from '@/lib/db/schema';
import { withProvisioningTransaction, withTenantTransaction, type DatabaseTransaction } from '@/lib/db/transactions';
import type { ProvisioningRepository, ServiceKey, Tenant, User, UserEmployeeAssociation } from '@/lib/provisioning/module';

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

function mapServiceKey(row: typeof serviceKeys.$inferSelect): ServiceKey {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  };
}

async function lockIdempotency(tx: DatabaseTransaction, scope: string, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${scope}), hashtext(${key}))`);
}

export class PostgresProvisioningRepository implements ProvisioningRepository {
  async createTenantIdempotently(input: Parameters<ProvisioningRepository['createTenantIdempotently']>[0]) {
    return withProvisioningTransaction(async (tx) => {
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
    return withProvisioningTransaction(async (tx) => {
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
    return withProvisioningTransaction(async (tx) => {
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

  async associateUserIdempotently(input: Parameters<ProvisioningRepository['associateUserIdempotently']>[0]) {
    const scope = `tenant:${input.tenantId}:employee:user:associate`;
    return withTenantTransaction(input.tenantId, async (tx) => {
      await lockIdempotency(tx, scope, input.idempotencyKey);
      const [existing] = await tx.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, input.idempotencyKey),
      )).limit(1);
      if (existing) {
        const [employee] = await tx.select().from(employees).where(and(
          eq(employees.id, existing.resourceId),
          eq(employees.tenantId, input.tenantId),
        )).limit(1);
        if (!employee?.userId) throw new Error('Associação idempotente não encontrada.');
        const association: UserEmployeeAssociation = {
          tenantId: employee.tenantId,
          employeeId: employee.id,
          userId: employee.userId,
          associatedAt: existing.createdAt,
        };
        return { association, replayed: true, requestHash: existing.requestHash };
      }

      const [user] = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.id, input.userId),
        eq(users.tenantId, input.tenantId),
        eq(users.role, 'employee'),
        eq(users.status, 'active'),
      )).limit(1);
      if (!user) throw new Error('Usuário funcionário não encontrado no tenant.');
      const [employee] = await tx.select({ id: employees.id, userId: employees.userId }).from(employees).where(and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId),
      )).limit(1);
      if (!employee) throw new Error('Funcionário não encontrado no tenant.');
      if (employee.userId && employee.userId !== input.userId) {
        throw new Error('Funcionário já associado a outro usuário.');
      }
      const [otherEmployee] = await tx.select({ id: employees.id }).from(employees).where(and(
        eq(employees.tenantId, input.tenantId),
        eq(employees.userId, input.userId),
        ne(employees.id, input.employeeId),
      )).limit(1);
      if (otherEmployee) throw new Error('Usuário já associado a outro funcionário.');
      const [updated] = await tx.update(employees).set({
        userId: input.userId,
        updatedAt: input.associatedAt,
      }).where(and(
        eq(employees.id, input.employeeId),
        eq(employees.tenantId, input.tenantId),
      )).returning();
      if (!updated) throw new Error('Funcionário não encontrado no tenant.');

      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: input.tenantId,
        eventType: 'employee.user_associated', entityType: 'employee', entityId: input.employeeId,
        metadata: { userId: input.userId }, occurredAt: input.associatedAt,
      });
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(), tenantId: input.tenantId, scope,
        key: input.idempotencyKey, requestHash: input.requestHash,
        resourceId: input.employeeId, responseStatus: 200, createdAt: input.associatedAt,
      });
      return {
        association: {
          tenantId: input.tenantId,
          employeeId: input.employeeId,
          userId: input.userId,
          associatedAt: input.associatedAt,
        },
        replayed: false,
        requestHash: input.requestHash,
      };
    });
  }

  async createServiceKeyIdempotently(input: Parameters<ProvisioningRepository['createServiceKeyIdempotently']>[0]) {
    const scope = `tenant:${input.serviceKey.tenantId}:service-key:create`;
    return withProvisioningTransaction(async (tx) => {
      await lockIdempotency(tx, scope, input.idempotencyKey);
      const [existing] = await tx.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.scope, scope),
        eq(idempotencyRecords.key, input.idempotencyKey),
      )).limit(1);
      if (existing) {
        const [serviceKey] = await tx.select().from(serviceKeys).where(eq(serviceKeys.id, existing.resourceId)).limit(1);
        if (!serviceKey) throw new Error('Chave de serviço idempotente não encontrada.');
        return { serviceKey: mapServiceKey(serviceKey), replayed: true, requestHash: existing.requestHash };
      }
      const [created] = await tx.insert(serviceKeys).values({
        ...input.serviceKey,
        keyHash: input.keyHash,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: created.tenantId,
        eventType: 'service_key.created', entityType: 'service_key', entityId: created.id,
        metadata: { name: created.name }, occurredAt: created.createdAt,
      });
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(), tenantId: created.tenantId, scope,
        key: input.idempotencyKey, requestHash: input.requestHash,
        resourceId: created.id, responseStatus: 201, createdAt: created.createdAt,
      });
      return { serviceKey: mapServiceKey(created), replayed: false, requestHash: input.requestHash };
    });
  }
}
