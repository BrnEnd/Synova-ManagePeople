import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import { auditEvents, employees, externalHiringRecords } from '@/lib/db/schema';
import { withTenantTransaction, type DatabaseTransaction } from '@/lib/db/transactions';
import type { Employee } from '@/lib/employees/module';
import type { HiringRecord, HiringRepository } from '@/lib/integrations/hiring/module';

function mapEmployee(row: typeof employees.$inferSelect): Employee {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    fullName: row.fullName,
    personalEmail: row.email,
    corporateEmail: row.corporateEmail,
    phone: row.phone,
    identificationDocument: row.document,
    address: row.address,
    entryDate: row.entryDate,
    professionalTitle: row.professionalTitle,
    employmentType: row.employmentType,
    status: row.status,
    onboardingPending: row.onboardingPending,
    missingFields: row.missingFields,
    createdAt: row.createdAt,
    inactivatedAt: row.inactivatedAt,
  };
}

function mapHiring(row: typeof externalHiringRecords.$inferSelect): HiringRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    externalHiringId: row.externalHiringId,
    idempotencyKey: row.idempotencyKey,
    employeeId: row.employeeId,
    requestHash: row.requestHash,
    missingFields: row.missingFields,
    createdAt: row.createdAt,
  };
}

async function lockRequest(
  transaction: DatabaseTransaction,
  tenantId: string,
  externalHiringId: string,
  idempotencyKey: string,
) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('external-hiring'), hashtext(${`${tenantId}:${externalHiringId}`}))`);
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext('external-hiring-idempotency'), hashtext(${`${tenantId}:${idempotencyKey}`}))`);
}

export class PostgresHiringRepository implements HiringRepository {
  async createIdempotently(input: Parameters<HiringRepository['createIdempotently']>[0]) {
    return withTenantTransaction(input.hiring.tenantId, async (transaction) => {
      await lockRequest(
        transaction,
        input.hiring.tenantId,
        input.hiring.externalHiringId,
        input.hiring.idempotencyKey,
      );
      const [existing] = await transaction.select().from(externalHiringRecords).where(or(
        and(
          eq(externalHiringRecords.tenantId, input.hiring.tenantId),
          eq(externalHiringRecords.externalHiringId, input.hiring.externalHiringId),
        ),
        and(
          eq(externalHiringRecords.tenantId, input.hiring.tenantId),
          eq(externalHiringRecords.idempotencyKey, input.hiring.idempotencyKey),
        ),
      )).limit(1);
      if (existing) {
        const [employee] = await transaction.select().from(employees).where(and(
          eq(employees.tenantId, input.hiring.tenantId),
          eq(employees.id, existing.employeeId),
        )).limit(1);
        if (!employee) throw new Error('Funcionário da contratação externa não encontrado.');
        return {
          employee: mapEmployee(employee),
          hiring: mapHiring(existing),
          replayed: true,
          requestHash: existing.requestHash,
        };
      }

      const [employee] = await transaction.insert(employees).values({
        id: input.employee.id,
        tenantId: input.employee.tenantId,
        userId: input.employee.userId,
        fullName: input.employee.fullName,
        email: input.employee.personalEmail,
        corporateEmail: input.employee.corporateEmail,
        phone: input.employee.phone,
        document: input.employee.identificationDocument,
        address: input.employee.address,
        entryDate: input.employee.entryDate,
        professionalTitle: input.employee.professionalTitle,
        employmentType: input.employee.employmentType,
        status: input.employee.status,
        onboardingPending: input.employee.onboardingPending,
        missingFields: input.employee.missingFields,
        createdAt: input.employee.createdAt,
        inactivatedAt: input.employee.inactivatedAt,
        updatedAt: input.employee.createdAt,
      }).returning();
      const [hiring] = await transaction.insert(externalHiringRecords).values(input.hiring).returning();
      await transaction.insert(auditEvents).values({
        id: randomUUID(), tenantId: employee.tenantId,
        eventType: 'employee.external_pre_registered', entityType: 'employee', entityId: employee.id,
        metadata: {
          source: 'portal_de_vagas',
          externalHiringId: hiring.externalHiringId,
          missingFields: hiring.missingFields,
        },
        occurredAt: hiring.createdAt,
      });
      return {
        employee: mapEmployee(employee),
        hiring: mapHiring(hiring),
        replayed: false,
        requestHash: hiring.requestHash,
      };
    });
  }
}
