import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { allocations, auditEvents, clients, competenceEvents, competencies, employees, financialConditions, notifications, tenants, timeEntries, users } from '@/lib/db/schema';
import { getProvisioningDb } from '@/lib/db/client';
import { withTenantTransaction, type DatabaseTransaction } from '@/lib/db/transactions';
import { InvalidApprovalError, type ApprovalRepository, type CompetenceReview } from '@/lib/approvals/module';

const selection = {
  id: competencies.id, tenantId: competencies.tenantId, employeeId: competencies.employeeId,
  allocationId: competencies.allocationId, clientId: competencies.clientId, managerUserId: competencies.managerUserId,
  employeeName: employees.fullName, clientName: clients.name, managerName: users.displayName,
  referenceMonth: competencies.referenceMonth, status: competencies.status, totalMinutes: competencies.totalMinutes,
  revision: competencies.revision, submittedAt: competencies.submittedAt, approvedAt: competencies.approvedAt,
  approvedByUserId: competencies.approvedByUserId, approvedMinutes: competencies.approvedMinutes,
  hourlyRateCents: competencies.hourlyRateCents, approvedAmountCents: competencies.approvedAmountCents,
  adjustmentReason: competencies.adjustmentReason, createdAt: competencies.createdAt, updatedAt: competencies.updatedAt,
  forecastDocumentId: competencies.forecastDocumentId, invoiceDocumentId: competencies.invoiceDocumentId,
};

async function managerReview(tx: DatabaseTransaction, tenantId: string, managerUserId: string, competenceId: string): Promise<CompetenceReview | null> {
  const [competence] = await tx.select(selection).from(competencies)
    .innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
    .innerJoin(clients, and(eq(clients.tenantId, competencies.tenantId), eq(clients.id, competencies.clientId)))
    .innerJoin(users, and(eq(users.tenantId, competencies.tenantId), eq(users.id, competencies.managerUserId)))
    .where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.managerUserId, managerUserId))).limit(1);
  if (!competence) return null;
  const [entries, events] = await Promise.all([
    tx.select().from(timeEntries).where(and(eq(timeEntries.tenantId, tenantId), eq(timeEntries.competenceId, competenceId))).orderBy(asc(timeEntries.workDate)),
    tx.select({ id: competenceEvents.id, eventType: competenceEvents.eventType, fromStatus: competenceEvents.fromStatus, toStatus: competenceEvents.toStatus, reason: competenceEvents.reason, actorName: users.displayName, occurredAt: competenceEvents.occurredAt })
      .from(competenceEvents).leftJoin(users, and(eq(users.tenantId, competenceEvents.tenantId), eq(users.id, competenceEvents.actorUserId)))
      .where(and(eq(competenceEvents.tenantId, tenantId), eq(competenceEvents.competenceId, competenceId))).orderBy(desc(competenceEvents.occurredAt)),
  ]);
  return { competence, entries, events };
}

async function notify(tx: DatabaseTransaction, input: { id: string; tenantId: string; recipientUserId: string; competenceId: string | null; type: string; title: string; message: string; key: string; at: Date }) {
  await tx.insert(notifications).values({ id: input.id, tenantId: input.tenantId, recipientUserId: input.recipientUserId, competenceId: input.competenceId, type: input.type, title: input.title, message: input.message, deduplicationKey: input.key, createdAt: input.at }).onConflictDoNothing({ target: [notifications.tenantId, notifications.deduplicationKey] });
}

export class PostgresApprovalRepository implements ApprovalRepository {
  submit(tenantId: string, employeeUserId: string, competenceId: string, eventId: string, notificationId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [current] = await tx.select({ id: competencies.id, employeeId: competencies.employeeId, managerUserId: competencies.managerUserId, status: competencies.status, totalMinutes: competencies.totalMinutes, revision: competencies.revision })
        .from(competencies).innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId)))
        .where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(employees.userId, employeeUserId), inArray(competencies.status, ['filling', 'adjustments_requested']))).limit(1);
      if (!current) return null; if (current.totalMinutes <= 0) throw new InvalidApprovalError('Lance ao menos uma hora antes de enviar.');
      const revision = current.status === 'adjustments_requested' ? current.revision + 1 : current.revision;
      await tx.update(competencies).set({ status: 'awaiting_approval', submittedAt: at, adjustmentReason: null, revision, updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.status, current.status)));
      await tx.insert(competenceEvents).values({ id: eventId, tenantId, competenceId, actorUserId: employeeUserId, eventType: current.status === 'adjustments_requested' ? 'competence.resubmitted' : 'competence.submitted', fromStatus: current.status, toStatus: 'awaiting_approval', metadata: { totalMinutes: current.totalMinutes, revision }, occurredAt: at });
      await notify(tx, { id: notificationId, tenantId, recipientUserId: current.managerUserId, competenceId, type: 'hours_submitted', title: 'Horas aguardando aprovação', message: `Uma competência com ${current.totalMinutes} minutos foi enviada para sua análise.`, key: `competence:${competenceId}:submitted:${revision}`, at });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: employeeUserId, eventType: 'competence.submitted', entityType: 'competence', entityId: competenceId, metadata: { totalMinutes: current.totalMinutes, revision }, occurredAt: at });
      return managerReview(tx, tenantId, current.managerUserId, competenceId);
    });
  }

  listForManager(tenantId: string, managerUserId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const rows = await tx.select({ id: competencies.id }).from(competencies).where(and(eq(competencies.tenantId, tenantId), eq(competencies.managerUserId, managerUserId), inArray(competencies.status, ['awaiting_approval', 'awaiting_payment']))).orderBy(asc(competencies.submittedAt));
      return Promise.all(rows.map((row) => managerReview(tx, tenantId, managerUserId, row.id))) as Promise<CompetenceReview[]>;
    });
  }

  getForManager(tenantId: string, managerUserId: string, competenceId: string) { return withTenantTransaction(tenantId, (tx) => managerReview(tx, tenantId, managerUserId, competenceId)); }

  requestAdjustments(tenantId: string, managerUserId: string, competenceId: string, reason: string, eventId: string, notificationId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [current] = await tx.select({ employeeId: competencies.employeeId, revision: competencies.revision }).from(competencies).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.managerUserId, managerUserId), eq(competencies.status, 'awaiting_approval'))).limit(1);
      if (!current) return null;
      const [employee] = await tx.select({ userId: employees.userId }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.id, current.employeeId))).limit(1);
      if (!employee?.userId) throw new InvalidApprovalError('O funcionário não possui usuário associado.');
      await tx.update(competencies).set({ status: 'adjustments_requested', adjustmentReason: reason, updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.status, 'awaiting_approval')));
      await tx.insert(competenceEvents).values({ id: eventId, tenantId, competenceId, actorUserId: managerUserId, eventType: 'competence.adjustments_requested', fromStatus: 'awaiting_approval', toStatus: 'adjustments_requested', reason, metadata: { revision: current.revision }, occurredAt: at });
      await notify(tx, { id: notificationId, tenantId, recipientUserId: employee.userId, competenceId, type: 'adjustments_requested', title: 'Ajustes solicitados', message: reason, key: `competence:${competenceId}:adjustments:${current.revision}`, at });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: managerUserId, eventType: 'competence.adjustments_requested', entityType: 'competence', entityId: competenceId, metadata: { reason, revision: current.revision }, occurredAt: at });
      return managerReview(tx, tenantId, managerUserId, competenceId);
    });
  }

  approve(tenantId: string, managerUserId: string, competenceId: string, eventId: string, notificationId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [current] = await tx.select({ employeeId: competencies.employeeId, totalMinutes: competencies.totalMinutes, referenceMonth: competencies.referenceMonth, revision: competencies.revision }).from(competencies).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.managerUserId, managerUserId), eq(competencies.status, 'awaiting_approval'))).limit(1);
      if (!current) return null;
      const [year, month] = current.referenceMonth.split('-').map(Number); const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const [[condition], [employee]] = await Promise.all([
        tx.select({ hourlyRateCents: financialConditions.hourlyRateCents }).from(financialConditions).where(and(eq(financialConditions.tenantId, tenantId), eq(financialConditions.employeeId, current.employeeId), lte(financialConditions.effectiveFrom, endDate), or(isNull(financialConditions.effectiveTo), gte(financialConditions.effectiveTo, endDate)))).orderBy(desc(financialConditions.effectiveFrom)).limit(1),
        tx.select({ userId: employees.userId }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.id, current.employeeId))).limit(1),
      ]);
      if (!condition) throw new InvalidApprovalError('Cadastre uma condição financeira vigente antes de aprovar.');
      if (!employee?.userId) throw new InvalidApprovalError('O funcionário não possui usuário associado.');
      const approvedAmountCents = Math.round(condition.hourlyRateCents * current.totalMinutes / 60);
      await tx.update(competencies).set({ status: 'awaiting_invoice', approvedAt: at, approvedByUserId: managerUserId, approvedMinutes: current.totalMinutes, hourlyRateCents: condition.hourlyRateCents, approvedAmountCents, updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.status, 'awaiting_approval')));
      await tx.insert(competenceEvents).values({ id: eventId, tenantId, competenceId, actorUserId: managerUserId, eventType: 'competence.approved', fromStatus: 'awaiting_approval', toStatus: 'awaiting_invoice', metadata: { revision: current.revision, approvedMinutes: current.totalMinutes, hourlyRateCents: condition.hourlyRateCents, approvedAmountCents }, occurredAt: at });
      await notify(tx, { id: notificationId, tenantId, recipientUserId: employee.userId, competenceId, type: 'hours_approved', title: 'Horas aprovadas', message: 'Suas horas foram aprovadas. A previsão de pagamento será disponibilizada.', key: `competence:${competenceId}:approved:${current.revision}`, at });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: managerUserId, eventType: 'competence.approved', entityType: 'competence', entityId: competenceId, metadata: { approvedMinutes: current.totalMinutes, hourlyRateCents: condition.hourlyRateCents, approvedAmountCents }, occurredAt: at });
      return managerReview(tx, tenantId, managerUserId, competenceId);
    });
  }

  listNotifications(tenantId: string, recipientUserId: string) { return withTenantTransaction(tenantId, (tx) => tx.select({ id: notifications.id, type: notifications.type, title: notifications.title, message: notifications.message, competenceId: notifications.competenceId, readAt: notifications.readAt, createdAt: notifications.createdAt }).from(notifications).where(and(eq(notifications.tenantId, tenantId), eq(notifications.recipientUserId, recipientUserId))).orderBy(desc(notifications.createdAt)).limit(50)); }

  markNotificationRead(tenantId: string, recipientUserId: string, notificationId: string, at: Date) { return withTenantTransaction(tenantId, async (tx) => (await tx.update(notifications).set({ readAt: at }).where(and(eq(notifications.tenantId, tenantId), eq(notifications.recipientUserId, recipientUserId), eq(notifications.id, notificationId))).returning({ id: notifications.id, type: notifications.type, title: notifications.title, message: notifications.message, competenceId: notifications.competenceId, readAt: notifications.readAt, createdAt: notifications.createdAt }))[0] ?? null); }

  async listActiveTenantIds() { return (await getProvisioningDb().select({ id: tenants.id }).from(tenants).where(eq(tenants.status, 'active'))).map((tenant) => tenant.id); }

  createMonthCloseReminders(tenantId: string, referenceMonth: string, at: Date, generateId: () => string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [year, month] = referenceMonth.split('-').map(Number); const endDate = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const candidates = await tx.selectDistinct({ userId: employees.userId, competenceId: competencies.id, status: competencies.status }).from(employees)
        .innerJoin(allocations, and(eq(allocations.tenantId, employees.tenantId), eq(allocations.employeeId, employees.id), lte(allocations.startDate, endDate), or(isNull(allocations.endDate), gte(allocations.endDate, referenceMonth))))
        .leftJoin(competencies, and(eq(competencies.tenantId, employees.tenantId), eq(competencies.employeeId, employees.id), eq(competencies.referenceMonth, referenceMonth)))
        .where(and(eq(employees.tenantId, tenantId), eq(employees.status, 'active')));
      let created = 0;
      for (const candidate of candidates) {
        if (!candidate.userId || (candidate.status && !inArrayValue(candidate.status, ['filling', 'adjustments_requested']))) continue;
        const result = await tx.insert(notifications).values({ id: generateId(), tenantId, recipientUserId: candidate.userId, competenceId: candidate.competenceId, type: 'month_close_reminder', title: 'Feche sua competência', message: 'Hoje é o último dia útil do mês. Revise e envie suas horas para aprovação.', deduplicationKey: `month-close:${referenceMonth}:${candidate.userId}`, createdAt: at }).onConflictDoNothing({ target: [notifications.tenantId, notifications.deduplicationKey] }).returning({ id: notifications.id });
        created += result.length;
      }
      return created;
    });
  }
}

function inArrayValue<T>(value: T, values: readonly T[]) { return values.includes(value); }
