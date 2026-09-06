import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { auditEvents, employees, idempotencyRecords, users } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import {
  EmployeeAccessConflictError,
  EmployeeAccessNotFoundError,
  assertEmployeeAccessAvailable,
  type AccessEmployee,
  type AccessUser,
  type EmployeeAccessAccounts,
} from '@/lib/employee-access/module';

const ACCESS_SCOPE = 'employee:portal-access:create';

function mapEmployee(row: typeof employees.$inferSelect): AccessEmployee {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    fullName: row.fullName,
    personalEmail: row.email,
    status: row.status,
    onboardingPending: row.onboardingPending,
  };
}

function mapUser(row: typeof users.$inferSelect): AccessUser {
  if (row.role !== 'employee' || row.status !== 'active' || !row.mustChangePassword) {
    throw new Error('Usuário idempotente inválido para o acesso do funcionário.');
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    mustChangePassword: true,
  };
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export class PostgresEmployeeAccessAccounts implements EmployeeAccessAccounts {
  async getEmployee(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [employee] = await tx.select().from(employees).where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, employeeId),
      )).limit(1);
      return employee ? mapEmployee(employee) : null;
    });
  }

  async createAccess(input: Parameters<EmployeeAccessAccounts['createAccess']>[0]) {
    try {
      return await withTenantTransaction(input.tenantId, async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${ACCESS_SCOPE}), hashtext(${input.idempotencyKey}))`);
        const [existing] = await tx.select().from(idempotencyRecords).where(and(
          eq(idempotencyRecords.scope, ACCESS_SCOPE),
          eq(idempotencyRecords.key, input.idempotencyKey),
        )).limit(1);

        if (existing) {
          if (existing.requestHash !== input.requestHash) {
            throw new EmployeeAccessConflictError('A criação deste acesso já foi processada com outros dados.');
          }
          const [user] = await tx.select().from(users).where(and(
            eq(users.tenantId, input.tenantId),
            eq(users.id, existing.resourceId),
          )).limit(1);
          if (!user) throw new Error('Usuário do registro idempotente não encontrado.');
          return { user: mapUser(user), replayed: true };
        }

        await tx.execute(sql`
          select id from employees
          where tenant_id = ${input.tenantId} and id = ${input.employeeId}
          for update
        `);
        const [employee] = await tx.select().from(employees).where(and(
          eq(employees.tenantId, input.tenantId),
          eq(employees.id, input.employeeId),
        )).limit(1);
        if (!employee) throw new EmployeeAccessNotFoundError();
        const currentEmployee = mapEmployee(employee);
        assertEmployeeAccessAvailable(currentEmployee);
        if (
          currentEmployee.personalEmail!.trim().toLowerCase() !== input.user.email
          || currentEmployee.fullName.trim() !== input.user.displayName
        ) {
          throw new EmployeeAccessConflictError('Os dados do funcionário mudaram. Atualize a página e tente novamente.');
        }

        const [createdUser] = await tx.insert(users).values({
          ...input.user,
          passwordSalt: input.credentials.passwordSalt,
          passwordHash: input.credentials.passwordHash,
          updatedAt: input.createdAt,
        }).returning();
        const [associatedEmployee] = await tx.update(employees).set({
          userId: createdUser.id,
          updatedAt: input.createdAt,
        }).where(and(
          eq(employees.tenantId, input.tenantId),
          eq(employees.id, input.employeeId),
          isNull(employees.userId),
          eq(employees.status, 'active'),
          eq(employees.onboardingPending, false),
          eq(employees.email, currentEmployee.personalEmail!),
        )).returning({ id: employees.id });
        if (!associatedEmployee) {
          throw new EmployeeAccessConflictError('O funcionário deixou de estar disponível para criação de acesso.');
        }
        await tx.insert(auditEvents).values([
          {
            id: randomUUID(),
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            eventType: 'user.created',
            entityType: 'user',
            entityId: createdUser.id,
            metadata: { email: createdUser.email, role: createdUser.role },
            occurredAt: input.createdAt,
          },
          {
            id: randomUUID(),
            tenantId: input.tenantId,
            actorUserId: input.actorUserId,
            eventType: 'employee.user_associated',
            entityType: 'employee',
            entityId: input.employeeId,
            metadata: { userId: createdUser.id },
            occurredAt: input.createdAt,
          },
        ]);
        await tx.insert(idempotencyRecords).values({
          id: randomUUID(),
          tenantId: input.tenantId,
          scope: ACCESS_SCOPE,
          key: input.idempotencyKey,
          requestHash: input.requestHash,
          resourceId: createdUser.id,
          responseStatus: 201,
          createdAt: input.createdAt,
        });
        return { user: mapUser(createdUser), replayed: false };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new EmployeeAccessConflictError();
      throw error;
    }
  }
}
