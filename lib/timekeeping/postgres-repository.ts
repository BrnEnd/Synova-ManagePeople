import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import { allocations, auditEvents, clients, competencies, employees, timeEntries, users } from '@/lib/db/schema';
import { withTenantTransaction, type DatabaseTransaction } from '@/lib/db/transactions';
import type { Competence, CompetenceDetail, TimeEntry, TimekeepingRepository } from '@/lib/timekeeping/module';

function monthEnd(referenceMonth: string) {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

const competenceSelection = {
  id: competencies.id, tenantId: competencies.tenantId, employeeId: competencies.employeeId,
  allocationId: competencies.allocationId, clientId: competencies.clientId, managerUserId: competencies.managerUserId,
  clientName: clients.name, managerName: users.displayName, referenceMonth: competencies.referenceMonth,
  status: competencies.status, totalMinutes: competencies.totalMinutes, revision: competencies.revision,
  submittedAt: competencies.submittedAt, approvedAt: competencies.approvedAt, approvedByUserId: competencies.approvedByUserId,
  approvedMinutes: competencies.approvedMinutes, hourlyRateCents: competencies.hourlyRateCents,
  approvedAmountCents: competencies.approvedAmountCents, adjustmentReason: competencies.adjustmentReason,
  forecastDocumentId: competencies.forecastDocumentId, invoiceDocumentId: competencies.invoiceDocumentId,
  createdAt: competencies.createdAt, updatedAt: competencies.updatedAt,
};

async function detailFor(tx: DatabaseTransaction, tenantId: string, userId: string, competenceId: string): Promise<CompetenceDetail | null> {
  const [competence] = await tx.select(competenceSelection).from(competencies)
    .innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
    .innerJoin(clients, and(eq(clients.tenantId, competencies.tenantId), eq(clients.id, competencies.clientId)))
    .innerJoin(users, and(eq(users.tenantId, competencies.tenantId), eq(users.id, competencies.managerUserId)))
    .where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(employees.userId, userId))).limit(1);
  if (!competence) return null;
  const entries = await tx.select().from(timeEntries).where(and(
    eq(timeEntries.tenantId, tenantId), eq(timeEntries.competenceId, competenceId),
  )).orderBy(asc(timeEntries.workDate));
  return { competence, entries };
}

async function recalculate(tx: DatabaseTransaction, tenantId: string, competenceId: string, at: Date) {
  const [row] = await tx.select({ total: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)::int` }).from(timeEntries).where(and(
    eq(timeEntries.tenantId, tenantId), eq(timeEntries.competenceId, competenceId),
  ));
  await tx.update(competencies).set({ totalMinutes: row.total, updatedAt: at }).where(and(
    eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId),
  ));
}

export class PostgresTimekeepingRepository implements TimekeepingRepository {
  openCompetence(tenantId: string, userId: string, referenceMonth: string, competenceId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [employee] = await tx.select({ id: employees.id }).from(employees).where(and(
        eq(employees.tenantId, tenantId), eq(employees.userId, userId), eq(employees.status, 'active'),
      )).limit(1);
      if (!employee) return null;
      const [existing] = await tx.select({ id: competencies.id }).from(competencies).where(and(
        eq(competencies.tenantId, tenantId), eq(competencies.employeeId, employee.id), eq(competencies.referenceMonth, referenceMonth),
      )).limit(1);
      if (existing) return detailFor(tx, tenantId, userId, existing.id);

      const [allocation] = await tx.select().from(allocations).where(and(
        eq(allocations.tenantId, tenantId), eq(allocations.employeeId, employee.id), lte(allocations.startDate, monthEnd(referenceMonth)),
        or(isNull(allocations.endDate), gte(allocations.endDate, referenceMonth)),
      )).orderBy(desc(allocations.startDate), desc(allocations.createdAt)).limit(1);
      if (!allocation) return null;
      const [created] = await tx.insert(competencies).values({
        id: competenceId, tenantId, employeeId: employee.id, allocationId: allocation.id,
        clientId: allocation.clientId, managerUserId: allocation.managerUserId, referenceMonth,
        status: 'filling', totalMinutes: 0, revision: 1, createdAt: at, updatedAt: at,
      }).onConflictDoNothing({ target: [competencies.tenantId, competencies.employeeId, competencies.referenceMonth] }).returning({ id: competencies.id });
      const id = created?.id ?? (await tx.select({ id: competencies.id }).from(competencies).where(and(
        eq(competencies.tenantId, tenantId), eq(competencies.employeeId, employee.id), eq(competencies.referenceMonth, referenceMonth),
      )).limit(1))[0].id;
      if (created) await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: userId, eventType: 'competence.created', entityType: 'competence', entityId: id, metadata: { employeeId: employee.id, allocationId: allocation.id, referenceMonth }, occurredAt: at });
      return detailFor(tx, tenantId, userId, id);
    });
  }

  listCompetencies(tenantId: string, userId: string) {
    return withTenantTransaction(tenantId, (tx) => tx.select(competenceSelection).from(competencies)
      .innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
      .innerJoin(clients, and(eq(clients.tenantId, competencies.tenantId), eq(clients.id, competencies.clientId)))
      .innerJoin(users, and(eq(users.tenantId, competencies.tenantId), eq(users.id, competencies.managerUserId)))
      .where(and(eq(competencies.tenantId, tenantId), eq(employees.userId, userId)))
      .orderBy(desc(competencies.referenceMonth)) as Promise<Competence[]>);
  }

  getOwnedCompetence(tenantId: string, userId: string, competenceId: string) {
    return withTenantTransaction(tenantId, (tx) => detailFor(tx, tenantId, userId, competenceId));
  }

  saveEntry(entry: TimeEntry, userId: string) {
    return withTenantTransaction(entry.tenantId, async (tx) => {
      const [editable] = await tx.select({ id: competencies.id }).from(competencies)
        .innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
        .where(and(eq(competencies.tenantId, entry.tenantId), eq(competencies.id, entry.competenceId), eq(employees.userId, userId), inArray(competencies.status, ['filling', 'adjustments_requested']))).limit(1);
      if (!editable) return null;
      const [saved] = await tx.insert(timeEntries).values(entry).onConflictDoUpdate({
        target: [timeEntries.tenantId, timeEntries.competenceId, timeEntries.workDate],
        set: { minutes: entry.minutes, observation: entry.observation, updatedAt: entry.updatedAt },
      }).returning();
      await recalculate(tx, entry.tenantId, entry.competenceId, entry.updatedAt);
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: entry.tenantId, actorUserId: userId, eventType: 'time_entry.saved', entityType: 'competence', entityId: entry.competenceId, metadata: { entryId: saved.id, workDate: saved.workDate, minutes: saved.minutes }, occurredAt: entry.updatedAt });
      return detailFor(tx, entry.tenantId, userId, entry.competenceId);
    });
  }

  deleteEntry(tenantId: string, userId: string, competenceId: string, entryId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [editable] = await tx.select({ id: competencies.id }).from(competencies)
        .innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
        .where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(employees.userId, userId), inArray(competencies.status, ['filling', 'adjustments_requested']))).limit(1);
      if (!editable) return null;
      const [deleted] = await tx.delete(timeEntries).where(and(eq(timeEntries.tenantId, tenantId), eq(timeEntries.competenceId, competenceId), eq(timeEntries.id, entryId))).returning({ id: timeEntries.id });
      if (!deleted) return null;
      await recalculate(tx, tenantId, competenceId, at);
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: userId, eventType: 'time_entry.deleted', entityType: 'competence', entityId: competenceId, metadata: { entryId }, occurredAt: at });
      return detailFor(tx, tenantId, userId, competenceId);
    });
  }
}
