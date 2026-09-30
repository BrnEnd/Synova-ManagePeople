import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import {
  allocations,
  auditEvents,
  commercialConditions,
  contracts,
  employees,
  financialConditions,
  idempotencyRecords,
  users,
} from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { DatabaseTransaction } from '@/lib/db/transactions';
import type { EmployeeOperationalReadiness } from '@/lib/employee-access/policy';
import { isEmployeeDocumentationMode } from '@/lib/document-onboarding/types';
import {
  EmployeeAccessConflictError,
  EmployeeAccessNotFoundError,
  assertEmployeeAccessAvailable,
  type AccessEmployee,
  type AccessUser,
  type EmployeeAccessAccounts,
} from '@/lib/employee-access/module';

const ACCESS_SCOPE = 'employee:portal-access:create';

function mapEmployee(row: typeof employees.$inferSelect, operationalReadiness?: EmployeeOperationalReadiness): AccessEmployee {
  if (!isEmployeeDocumentationMode(row.documentationMode)) throw new Error('Modo documental do funcionário inválido.');
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    fullName: row.fullName,
    personalEmail: row.email,
    status: row.status,
    onboardingPending: row.onboardingPending,
    documentationMode: row.documentationMode,
    documentationStatus: row.documentationStatus,
    operationalReadiness,
  };
}

async function operationalReadiness(
  tx: DatabaseTransaction,
  tenantId: string,
  employeeId: string,
): Promise<EmployeeOperationalReadiness> {
  const [[contract], [allocation], [financialCondition], [commercialCondition]] = await Promise.all([
    tx.select({ id: contracts.id }).from(contracts).where(and(
      eq(contracts.tenantId, tenantId),
      eq(contracts.employeeId, employeeId),
      eq(contracts.status, 'active'),
    )).limit(1),
    tx.select({ id: allocations.id }).from(allocations).where(and(
      eq(allocations.tenantId, tenantId),
      eq(allocations.employeeId, employeeId),
      eq(allocations.status, 'active'),
    )).limit(1),
    tx.select({ id: financialConditions.id }).from(financialConditions).where(and(
      eq(financialConditions.tenantId, tenantId),
      eq(financialConditions.employeeId, employeeId),
      isNull(financialConditions.effectiveTo),
    )).limit(1),
    tx.select({ id: commercialConditions.id }).from(commercialConditions).innerJoin(allocations, and(
      eq(allocations.tenantId, commercialConditions.tenantId),
      eq(allocations.id, commercialConditions.allocationId),
    )).where(and(
      eq(commercialConditions.tenantId, tenantId),
      eq(allocations.employeeId, employeeId),
      eq(allocations.status, 'active'),
      isNull(commercialConditions.effectiveTo),
    )).limit(1),
  ]);
  return {
    hasActiveContract: Boolean(contract),
    hasActiveAllocation: Boolean(allocation),
    hasFinancialCondition: Boolean(financialCondition),
    hasCommercialCondition: Boolean(commercialCondition),
  };
}

function activeOperationalRelationships(tenantId: string, employeeId: string) {
  return [
    sql`exists (select 1 from ${contracts} where ${contracts.tenantId} = ${tenantId} and ${contracts.employeeId} = ${employeeId} and ${contracts.status} = 'active')`,
    sql`exists (select 1 from ${allocations} where ${allocations.tenantId} = ${tenantId} and ${allocations.employeeId} = ${employeeId} and ${allocations.status} = 'active')`,
    sql`exists (select 1 from ${financialConditions} where ${financialConditions.tenantId} = ${tenantId} and ${financialConditions.employeeId} = ${employeeId} and ${financialConditions.effectiveTo} is null)`,
    sql`exists (select 1 from ${commercialConditions} inner join ${allocations} on ${allocations.tenantId} = ${commercialConditions.tenantId} and ${allocations.id} = ${commercialConditions.allocationId} where ${commercialConditions.tenantId} = ${tenantId} and ${allocations.employeeId} = ${employeeId} and ${allocations.status} = 'active' and ${commercialConditions.effectiveTo} is null)`,
  ];
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
      return employee ? mapEmployee(employee, await operationalReadiness(tx, tenantId, employeeId)) : null;
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
        const currentEmployee = mapEmployee(employee, await operationalReadiness(tx, input.tenantId, input.employeeId));
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
          sql`(${employees.documentationMode} = 'legacy' or ${employees.documentationStatus} = 'approved')`,
          eq(employees.email, currentEmployee.personalEmail!),
          ...activeOperationalRelationships(input.tenantId, input.employeeId),
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
