import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, lte, ne } from 'drizzle-orm';
import {
  allocations, auditEvents, clients, commercialConditions, contracts, documents,
  employees, financialConditions, users,
} from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import { InvalidWorkforceError, type Allocation, type CommercialCondition, type Contract, type FinancialCondition, type WorkforceRepository } from '@/lib/workforce/module';

export class PostgresWorkforceRepository implements WorkforceRepository {
  async employeeExists(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => Boolean((await tx.select({ id: employees.id }).from(employees).where(and(
      eq(employees.tenantId, tenantId), eq(employees.id, employeeId), ne(employees.status, 'inactive'),
    )).limit(1))[0]));
  }

  async documentBelongsToEmployee(tenantId: string, documentId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => Boolean((await tx.select({ id: documents.id }).from(documents).where(and(
      eq(documents.tenantId, tenantId), eq(documents.id, documentId), eq(documents.employeeId, employeeId), isNull(documents.archivedAt),
      eq(documents.type, 'contract'),
    )).limit(1))[0]));
  }

  async allocationExists(tenantId: string, allocationId: string) {
    return withTenantTransaction(tenantId, async (tx) => Boolean((await tx.select({ id: allocations.id }).from(allocations).where(and(
      eq(allocations.tenantId, tenantId), eq(allocations.id, allocationId),
    )).limit(1))[0]));
  }

  async createContract(contract: Contract, actorUserId: string) {
    return withTenantTransaction(contract.tenantId, async (tx) => {
      const [created] = await tx.insert(contracts).values(contract).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: contract.tenantId, actorUserId, eventType: 'contract.created',
        entityType: 'employee', entityId: contract.employeeId,
        metadata: { contractId: contract.id, contractType: contract.contractType, startDate: contract.startDate }, occurredAt: contract.createdAt,
      });
      return created;
    });
  }

  listContracts(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select().from(contracts).where(and(
      eq(contracts.tenantId, tenantId), eq(contracts.employeeId, employeeId),
    )).orderBy(desc(contracts.startDate), desc(contracts.createdAt)));
  }

  async endContract(tenantId: string, contractId: string, endDate: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [ended] = await tx.update(contracts).set({ endDate, status: 'ended', endedAt: at }).where(and(
        eq(contracts.tenantId, tenantId), eq(contracts.id, contractId), eq(contracts.status, 'active'), lte(contracts.startDate, endDate),
      )).returning();
      if (!ended) return null;
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId, eventType: 'contract.ended', entityType: 'employee', entityId: ended.employeeId, metadata: { contractId, endDate }, occurredAt: at });
      return ended;
    });
  }

  async createAllocation(allocation: Omit<Allocation, 'clientName' | 'managerName'>, actorUserId: string) {
    return withTenantTransaction(allocation.tenantId, async (tx) => {
      const [[client], [manager]] = await Promise.all([
        tx.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.tenantId, allocation.tenantId), eq(clients.id, allocation.clientId), eq(clients.status, 'active'))).limit(1),
        tx.select({ id: users.id, name: users.displayName }).from(users).where(and(eq(users.tenantId, allocation.tenantId), eq(users.id, allocation.managerUserId), eq(users.role, 'manager'), eq(users.status, 'active'))).limit(1),
      ]);
      if (!client) throw new InvalidWorkforceError('Selecione um cliente ativo deste tenant.');
      if (!manager) throw new InvalidWorkforceError('Selecione um gestor ativo deste tenant.');
      const [created] = await tx.insert(allocations).values(allocation).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: allocation.tenantId, actorUserId, eventType: 'allocation.created',
        entityType: 'employee', entityId: allocation.employeeId,
        metadata: { allocationId: allocation.id, clientId: allocation.clientId, managerUserId: allocation.managerUserId, startDate: allocation.startDate }, occurredAt: allocation.createdAt,
      });
      return { ...created, clientName: client.name, managerName: manager.name };
    });
  }

  listAllocations(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select({
      id: allocations.id, tenantId: allocations.tenantId, employeeId: allocations.employeeId,
      clientId: allocations.clientId, clientName: clients.name, managerUserId: allocations.managerUserId,
      managerName: users.displayName, roleTitle: allocations.roleTitle, startDate: allocations.startDate,
      endDate: allocations.endDate, status: allocations.status, observations: allocations.observations,
      createdByUserId: allocations.createdByUserId, createdAt: allocations.createdAt, endedAt: allocations.endedAt,
    }).from(allocations).innerJoin(clients, and(eq(clients.tenantId, allocations.tenantId), eq(clients.id, allocations.clientId)))
      .innerJoin(users, and(eq(users.tenantId, allocations.tenantId), eq(users.id, allocations.managerUserId)))
      .where(and(eq(allocations.tenantId, tenantId), eq(allocations.employeeId, employeeId)))
      .orderBy(desc(allocations.startDate), desc(allocations.createdAt)));
  }

  async endAllocation(tenantId: string, allocationId: string, endDate: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [ended] = await tx.update(allocations).set({ endDate, status: 'ended', endedAt: at }).where(and(
        eq(allocations.tenantId, tenantId), eq(allocations.id, allocationId), eq(allocations.status, 'active'), lte(allocations.startDate, endDate),
      )).returning();
      if (!ended) return null;
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId, eventType: 'allocation.ended', entityType: 'employee', entityId: ended.employeeId, metadata: { allocationId, endDate }, occurredAt: at });
      const [[client], [manager]] = await Promise.all([
        tx.select({ name: clients.name }).from(clients).where(and(eq(clients.tenantId, tenantId), eq(clients.id, ended.clientId))).limit(1),
        tx.select({ name: users.displayName }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.id, ended.managerUserId))).limit(1),
      ]);
      return { ...ended, clientName: client?.name ?? 'Cliente', managerName: manager?.name ?? 'Gestor' };
    });
  }

  listFinancialConditions(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select().from(financialConditions).where(and(
      eq(financialConditions.tenantId, tenantId), eq(financialConditions.employeeId, employeeId),
    )).orderBy(desc(financialConditions.effectiveFrom), desc(financialConditions.createdAt)));
  }

  async addFinancialCondition(condition: FinancialCondition, previousId: string | null, previousEnd: string | null, actorUserId: string) {
    return withTenantTransaction(condition.tenantId, async (tx) => {
      if (previousId && previousEnd) await tx.update(financialConditions).set({ effectiveTo: previousEnd }).where(and(
        eq(financialConditions.tenantId, condition.tenantId), eq(financialConditions.id, previousId), isNull(financialConditions.effectiveTo),
      ));
      const [created] = await tx.insert(financialConditions).values(condition).returning();
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: condition.tenantId, actorUserId, eventType: 'financial_condition.created', entityType: 'employee', entityId: condition.employeeId, metadata: { conditionId: condition.id, hourlyRateCents: condition.hourlyRateCents, effectiveFrom: condition.effectiveFrom }, occurredAt: condition.createdAt });
      return created;
    });
  }

  listCommercialConditions(tenantId: string, allocationId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select().from(commercialConditions).where(and(
      eq(commercialConditions.tenantId, tenantId), eq(commercialConditions.allocationId, allocationId),
    )).orderBy(desc(commercialConditions.effectiveFrom), desc(commercialConditions.createdAt)));
  }

  async addCommercialCondition(condition: CommercialCondition, previousId: string | null, previousEnd: string | null, actorUserId: string) {
    return withTenantTransaction(condition.tenantId, async (tx) => {
      if (previousId && previousEnd) await tx.update(commercialConditions).set({ effectiveTo: previousEnd }).where(and(
        eq(commercialConditions.tenantId, condition.tenantId), eq(commercialConditions.id, previousId), isNull(commercialConditions.effectiveTo),
      ));
      const [created] = await tx.insert(commercialConditions).values(condition).returning();
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: condition.tenantId, actorUserId, eventType: 'commercial_condition.created', entityType: 'allocation', entityId: condition.allocationId, metadata: { conditionId: condition.id, hourlyRateCents: condition.hourlyRateCents, effectiveFrom: condition.effectiveFrom }, occurredAt: condition.createdAt });
      return created;
    });
  }

  listOptions(tenantId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [clientRows, managerRows] = await Promise.all([
        tx.select({ id: clients.id, name: clients.name }).from(clients).where(and(eq(clients.tenantId, tenantId), eq(clients.status, 'active'))).orderBy(asc(clients.name)),
        tx.select({ id: users.id, name: users.displayName }).from(users).where(and(eq(users.tenantId, tenantId), eq(users.role, 'manager'), eq(users.status, 'active'))).orderBy(asc(users.displayName)),
      ]);
      return { clients: clientRows, managers: managerRows };
    });
  }
}
