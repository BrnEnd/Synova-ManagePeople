import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { auditEvents, clients, competenceEvents, competencies, documents, employees, notifications, payments } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { EmployeeDocument } from '@/lib/documents/module';
import type { FinanceRepository } from '@/lib/finance/module';

export class PostgresFinanceRepository implements FinanceRepository {
  getForecastData(tenantId: string, competenceId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [row] = await tx.select({ tenantId: competencies.tenantId, competenceId: competencies.id, employeeId: competencies.employeeId, employeeName: employees.fullName, clientName: clients.name, referenceMonth: competencies.referenceMonth, revision: competencies.revision, approvedMinutes: competencies.approvedMinutes, hourlyRateCents: competencies.hourlyRateCents, approvedAmountCents: competencies.approvedAmountCents, approvedAt: competencies.approvedAt, forecastDocumentId: competencies.forecastDocumentId })
        .from(competencies).innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId))).innerJoin(clients, and(eq(clients.tenantId, competencies.tenantId), eq(clients.id, competencies.clientId)))
        .where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId))).limit(1);
      if (!row || row.approvedMinutes === null || row.hourlyRateCents === null || row.approvedAmountCents === null || !row.approvedAt) return null;
      return { ...row, approvedMinutes: row.approvedMinutes, hourlyRateCents: row.hourlyRateCents, approvedAmountCents: row.approvedAmountCents, approvedAt: row.approvedAt };
    });
  }
  linkForecast(tenantId: string, competenceId: string, documentId: string, at: Date) { return withTenantTransaction(tenantId, async (tx) => Boolean((await tx.update(competencies).set({ forecastDocumentId: documentId, updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), isNull(competencies.forecastDocumentId))).returning({ id: competencies.id }))[0])); }
  getEmployeeCompetence(tenantId: string, userId: string, competenceId: string) { return withTenantTransaction(tenantId, async (tx) => (await tx.select({ employeeId: competencies.employeeId, status: competencies.status }).from(competencies).innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId))).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(employees.userId, userId))).limit(1))[0] ?? null); }
  documentMatches(tenantId: string, documentId: string, employeeId: string, type: EmployeeDocument['type']) { return withTenantTransaction(tenantId, async (tx) => Boolean((await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.tenantId, tenantId), eq(documents.id, documentId), eq(documents.employeeId, employeeId), eq(documents.type, type), isNull(documents.archivedAt))).limit(1))[0])); }
  linkInvoice(tenantId: string, userId: string, competenceId: string, documentId: string, eventId: string, notificationId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [current] = await tx.select({ managerUserId: competencies.managerUserId, revision: competencies.revision }).from(competencies).innerJoin(employees, and(eq(employees.tenantId, competencies.tenantId), eq(employees.id, competencies.employeeId))).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(employees.userId, userId), eq(competencies.status, 'awaiting_invoice'))).limit(1); if (!current) return false;
      await tx.update(competencies).set({ status: 'awaiting_payment', invoiceDocumentId: documentId, updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.status, 'awaiting_invoice')));
      await tx.insert(competenceEvents).values({ id: eventId, tenantId, competenceId, actorUserId: userId, eventType: 'competence.invoice_submitted', fromStatus: 'awaiting_invoice', toStatus: 'awaiting_payment', metadata: { documentId }, occurredAt: at });
      await tx.insert(notifications).values({ id: notificationId, tenantId, recipientUserId: current.managerUserId, competenceId, type: 'invoice_submitted', title: 'Nota Fiscal recebida', message: 'A Nota Fiscal foi enviada e a competência aguarda pagamento.', deduplicationKey: `competence:${competenceId}:invoice:${current.revision}`, createdAt: at }).onConflictDoNothing({ target: [notifications.tenantId, notifications.deduplicationKey] });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: userId, eventType: 'competence.invoice_submitted', entityType: 'competence', entityId: competenceId, metadata: { documentId }, occurredAt: at }); return true;
    });
  }
  recordPayment(tenantId: string, managerUserId: string, competenceId: string, receiptDocumentId: string, notes: string | null, paidAt: Date, paymentId: string, eventId: string, notificationId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [current] = await tx.select({ employeeId: competencies.employeeId, approvedAmountCents: competencies.approvedAmountCents, revision: competencies.revision }).from(competencies).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.managerUserId, managerUserId), eq(competencies.status, 'awaiting_payment'))).limit(1); if (!current?.approvedAmountCents) return null;
      const [employee] = await tx.select({ userId: employees.userId }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.id, current.employeeId))).limit(1); if (!employee?.userId) return null;
      const [payment] = await tx.insert(payments).values({ id: paymentId, tenantId, competenceId, employeeId: current.employeeId, amountCents: current.approvedAmountCents, paidAt, notes, receiptDocumentId, recordedByUserId: managerUserId, createdAt: at }).returning();
      await tx.update(competencies).set({ status: 'paid', updatedAt: at }).where(and(eq(competencies.tenantId, tenantId), eq(competencies.id, competenceId), eq(competencies.status, 'awaiting_payment')));
      await tx.insert(competenceEvents).values({ id: eventId, tenantId, competenceId, actorUserId: managerUserId, eventType: 'competence.payment_recorded', fromStatus: 'awaiting_payment', toStatus: 'paid', metadata: { paymentId, amountCents: current.approvedAmountCents, receiptDocumentId }, occurredAt: at });
      await tx.insert(notifications).values({ id: notificationId, tenantId, recipientUserId: employee.userId, competenceId, type: 'payment_recorded', title: 'Pagamento realizado', message: 'O pagamento foi registrado e o comprovante está disponível.', deduplicationKey: `competence:${competenceId}:payment:${current.revision}`, createdAt: at }).onConflictDoNothing({ target: [notifications.tenantId, notifications.deduplicationKey] });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: managerUserId, eventType: 'competence.payment_recorded', entityType: 'competence', entityId: competenceId, metadata: { paymentId, amountCents: current.approvedAmountCents, receiptDocumentId }, occurredAt: at }); return payment;
    });
  }
  getPayment(tenantId: string, competenceId: string) { return withTenantTransaction(tenantId, async (tx) => (await tx.select().from(payments).where(and(eq(payments.tenantId, tenantId), eq(payments.competenceId, competenceId))).limit(1))[0] ?? null); }
}
