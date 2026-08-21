import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, ne } from 'drizzle-orm';
import { auditEvents, clients } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { Client, ClientProfile, ClientRepository } from '@/lib/clients/module';

export class PostgresClientRepository implements ClientRepository {
  async create(client: Client, actorUserId: string) {
    return withTenantTransaction(client.tenantId, async (tx) => {
      const [created] = await tx.insert(clients).values(client).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: client.tenantId, actorUserId,
        eventType: 'client.created', entityType: 'client', entityId: client.id,
        metadata: { name: client.name }, occurredAt: client.createdAt,
      });
      return created;
    });
  }

  async list(tenantId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select().from(clients)
      .where(eq(clients.tenantId, tenantId)).orderBy(asc(clients.name)));
  }

  async get(tenantId: string, clientId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [client] = await tx.select().from(clients).where(and(
        eq(clients.tenantId, tenantId), eq(clients.id, clientId),
      )).limit(1);
      return client ?? null;
    });
  }

  async update(tenantId: string, clientId: string, profile: ClientProfile, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(clients).set({ ...profile, updatedAt: at }).where(and(
        eq(clients.tenantId, tenantId), eq(clients.id, clientId), ne(clients.status, 'inactive'),
      )).returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'client.updated', entityType: 'client', entityId: clientId,
        metadata: { name: updated.name }, occurredAt: at,
      });
      return updated;
    });
  }

  async inactivate(tenantId: string, clientId: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(clients).set({ status: 'inactive', inactivatedAt: at, updatedAt: at }).where(and(
        eq(clients.tenantId, tenantId), eq(clients.id, clientId), ne(clients.status, 'inactive'),
      )).returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'client.inactivated', entityType: 'client', entityId: clientId, occurredAt: at,
      });
      return updated;
    });
  }
}
