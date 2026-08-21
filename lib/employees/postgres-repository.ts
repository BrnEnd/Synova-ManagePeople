import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, ne } from 'drizzle-orm';
import { auditEvents, employees, users } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { Employee, EmployeeRepository } from '@/lib/employees/module';

function mapEmployee(row: typeof employees.$inferSelect): Employee {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    fullName: row.fullName,
    email: row.email,
    document: row.document,
    status: row.status,
    onboardingPending: row.onboardingPending,
    createdAt: row.createdAt,
    inactivatedAt: row.inactivatedAt,
  };
}

export class PostgresEmployeeRepository implements EmployeeRepository {
  async isUserLinkable(tenantId: string, userId: string, employeeId?: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [user] = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.role, 'employee'),
        eq(users.status, 'active'),
      )).limit(1);
      if (!user) return false;
      const conditions = [eq(employees.tenantId, tenantId), eq(employees.userId, userId)];
      if (employeeId) conditions.push(ne(employees.id, employeeId));
      const [linked] = await tx.select({ id: employees.id }).from(employees)
        .where(and(...conditions)).limit(1);
      return !linked;
    });
  }

  async create(employee: Employee, actorUserId: string) {
    return withTenantTransaction(employee.tenantId, async (tx) => {
      const [created] = await tx.insert(employees).values({
        ...employee,
        updatedAt: employee.createdAt,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: employee.tenantId, actorUserId,
        eventType: 'employee.created', entityType: 'employee', entityId: created.id,
        metadata: { status: created.status }, occurredAt: employee.createdAt,
      });
      return mapEmployee(created);
    });
  }

  async list(tenantId: string) {
    return withTenantTransaction(tenantId, async (tx) => (await tx.select().from(employees)
      .where(eq(employees.tenantId, tenantId)).orderBy(asc(employees.fullName))).map(mapEmployee));
  }

  async inactivate(tenantId: string, employeeId: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(employees).set({
        status: 'inactive', inactivatedAt: at, updatedAt: at,
      }).where(and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId),
        ne(employees.status, 'inactive'),
      )).returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'employee.inactivated', entityType: 'employee', entityId: employeeId,
        occurredAt: at,
      });
      return mapEmployee(updated);
    });
  }

  async associateUser(tenantId: string, employeeId: string, userId: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(employees).set({ userId, updatedAt: at })
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
        .returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'employee.user_associated', entityType: 'employee', entityId: employeeId,
        metadata: { userId }, occurredAt: at,
      });
      return mapEmployee(updated);
    });
  }
}
