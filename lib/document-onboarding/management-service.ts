import { randomUUID } from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditEvents,
  documentOnboardingItems,
  documentOnboardingRequests,
  employees,
  type DocumentOnboardingFormData,
} from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import { isItemReviewable, isReviewComplete } from '@/lib/document-onboarding/domain';
import { sendDocumentationEmail } from '@/lib/document-onboarding/email';
import { createOnboardingToken } from '@/lib/document-onboarding/token';
import {
  DocumentOnboardingError,
  expiryFrom,
  itemStatus,
  loadDetail,
  notifyManagers,
  requestStatus,
  type ManagerOnboardingDetail,
} from '@/lib/document-onboarding/shared';

async function sendSafely(input: Parameters<typeof sendDocumentationEmail>[0]) {
  try {
    await sendDocumentationEmail(input);
    return 'sent' as const;
  } catch (error) {
    console.error('Falha ao enviar e-mail de documentação:', error);
    return 'failed' as const;
  }
}

export class DocumentOnboardingManagementService {
  async getForManager(tenantId: string, employeeId: string): Promise<ManagerOnboardingDetail | null> {
    return withTenantTransaction(tenantId, async (tx) => {
      const [request] = await tx.select({ id: documentOnboardingRequests.id, status: documentOnboardingRequests.status, hasUploads: documentOnboardingRequests.hasUploads }).from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.employeeId, employeeId))).limit(1);
      if (!request || (request.status === 'cancelled' && !request.hasUploads)) return null;
      const detail = await loadDetail(tx, tenantId, request.id);
      return detail ? { request: detail.request, items: detail.items } : null;
    });
  }

  async recordManagerView(input: { tenantId: string; employeeId: string; actorUserId: string }) {
    await withTenantTransaction(input.tenantId, async (tx) => {
      const [request] = await tx.select({ id: documentOnboardingRequests.id }).from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.employeeId, input.employeeId))).limit(1);
      if (!request) return;
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: input.tenantId, actorUserId: input.actorUserId, eventType: 'documentation.viewed', entityType: 'employee', entityId: input.employeeId, metadata: { requestId: request.id }, occurredAt: new Date() });
    });
  }

  async review(input: { tenantId: string; employeeId: string; itemId: string; actorUserId: string; decision: 'approve' | 'reject'; reason?: string }) {
    if (input.decision === 'reject' && !input.reason?.trim()) throw new DocumentOnboardingError('Informe o motivo da reprovação.');
    const now = new Date();
    let email: Parameters<typeof sendDocumentationEmail>[0] | null = null;
    const result = await withTenantTransaction(input.tenantId, async (tx) => {
      await tx.execute(sql`select id from document_onboarding_requests where tenant_id = ${input.tenantId} and employee_id = ${input.employeeId} for update`);
      const [request] = await tx.select().from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.employeeId, input.employeeId))).limit(1);
      if (!request) throw new DocumentOnboardingError('Solicitação não encontrada.', 404);
      if (!['submitted', 'changes_requested'].includes(request.status)) throw new DocumentOnboardingError('A documentação ainda não está disponível para revisão.', 409);
      const [item] = await tx.select().from(documentOnboardingItems).where(and(eq(documentOnboardingItems.tenantId, input.tenantId), eq(documentOnboardingItems.requestId, request.id), eq(documentOnboardingItems.id, input.itemId))).limit(1);
      if (!item || !isItemReviewable(itemStatus(item.status), item.reviewable)) throw new DocumentOnboardingError('O item só pode ser revisado após o funcionário enviar esta rodada.', 409);
      const [reviewed] = await tx.update(documentOnboardingItems).set({ status: input.decision === 'approve' ? 'approved' : 'rejected', reviewable: false, rejectionReason: input.decision === 'reject' ? input.reason!.trim() : null, reviewedByUserId: input.actorUserId, reviewedAt: now, updatedAt: now }).where(and(eq(documentOnboardingItems.tenantId, input.tenantId), eq(documentOnboardingItems.id, item.id), eq(documentOnboardingItems.status, 'uploaded'), eq(documentOnboardingItems.reviewable, true))).returning({ id: documentOnboardingItems.id });
      if (!reviewed) throw new DocumentOnboardingError('Este item já foi revisado por outro gestor. Atualize a página.', 409);
      if (input.decision === 'reject') {
        if (request.status !== 'changes_requested') {
          const renewed = createOnboardingToken(input.tenantId, request.id);
          const expiresAt = expiryFrom(now);
          await tx.update(documentOnboardingRequests).set({ status: 'changes_requested', tokenHash: renewed.tokenHash, expiresAt, lastSentAt: now, revision: request.revision + 1, updatedAt: now }).where(eq(documentOnboardingRequests.id, request.id));
          await tx.update(employees).set({ documentationStatus: 'changes_requested', updatedAt: now }).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId)));
          const [employee] = await tx.select({ fullName: employees.fullName, email: employees.email }).from(employees).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId))).limit(1);
          if (employee?.email) email = { employeeName: employee.fullName, personalEmail: employee.email, token: renewed.token, expiresAt, kind: 'correction' };
        }
        await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: input.tenantId, actorUserId: input.actorUserId, eventType: 'documentation.item_rejected', entityType: 'employee', entityId: input.employeeId, metadata: { requestId: request.id, itemId: item.id, reason: input.reason!.trim() }, occurredAt: now });
        return { status: 'changes_requested' as const };
      }
      const statuses = await tx.select({ status: documentOnboardingItems.status }).from(documentOnboardingItems).where(and(eq(documentOnboardingItems.tenantId, input.tenantId), eq(documentOnboardingItems.requestId, request.id)));
      if (isReviewComplete(statuses.map((row) => itemStatus(row.status)))) {
        await tx.update(documentOnboardingRequests).set({ status: 'approved', approvedAt: now, updatedAt: now }).where(eq(documentOnboardingRequests.id, request.id));
        const missing = await tx.select({ fields: employees.missingFields }).from(employees).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId))).limit(1);
        const missingFields = request.employmentType === 'clt'
          ? (missing[0]?.fields ?? []).filter((field) => !['identificationDocument', 'phone', 'identificationDocumentFile'].includes(field))
          : (missing[0]?.fields ?? []);
        await tx.update(employees).set({ document: request.employmentType === 'clt' ? (request.data as DocumentOnboardingFormData).cpf : undefined, phone: request.employmentType === 'clt' ? (request.data as DocumentOnboardingFormData).phone : undefined, gender: request.employmentType === 'clt' ? (request.data as DocumentOnboardingFormData).gender : undefined, raceColor: request.employmentType === 'clt' ? (request.data as DocumentOnboardingFormData).raceColor : undefined, documentationStatus: 'approved', missingFields, onboardingPending: missingFields.length > 0, updatedAt: now }).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId)));
        await notifyManagers(tx, { tenantId: input.tenantId, employeeId: input.employeeId, type: 'documentation.approved', title: 'Documentação aprovada', message: 'A documentação foi aprovada. Complete as demais pendências do cadastro para liberar o acesso.', key: `documentation-approved:${request.id}` });
        await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: input.tenantId, actorUserId: input.actorUserId, eventType: 'documentation.approved', entityType: 'employee', entityId: input.employeeId, metadata: { requestId: request.id }, occurredAt: now });
        return { status: 'approved' as const };
      }
      return { status: requestStatus(request.status) };
    });
    return { ...result, notificationStatus: email ? await sendSafely(email) : null };
  }

  async renew(input: { tenantId: string; employeeId: string; actorUserId: string }) {
    const now = new Date();
    const result = await withTenantTransaction(input.tenantId, async (tx) => {
      const [request] = await tx.select().from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.employeeId, input.employeeId))).limit(1);
      if (!request || !['in_progress', 'changes_requested', 'expired'].includes(request.status)) throw new DocumentOnboardingError('Esta solicitação não pode ser renovada.', 409);
      const renewed = createOnboardingToken(input.tenantId, request.id);
      const expiresAt = expiryFrom(now);
      let nextStatus = request.status;
      if (request.status === 'expired') {
        const [rejected] = await tx.select({ id: documentOnboardingItems.id }).from(documentOnboardingItems).where(and(eq(documentOnboardingItems.tenantId, input.tenantId), eq(documentOnboardingItems.requestId, request.id), eq(documentOnboardingItems.status, 'rejected'))).limit(1);
        nextStatus = rejected ? 'changes_requested' : 'in_progress';
      }
      await tx.update(documentOnboardingRequests).set({ tokenHash: renewed.tokenHash, expiresAt, lastSentAt: now, status: nextStatus, purgedAt: null, updatedAt: now }).where(eq(documentOnboardingRequests.id, request.id));
      await tx.update(employees).set({ documentationStatus: nextStatus, updatedAt: now }).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId)));
      const [employee] = await tx.select({ fullName: employees.fullName, email: employees.email }).from(employees).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId))).limit(1);
      if (!employee?.email) throw new DocumentOnboardingError('E-mail pessoal não cadastrado.');
      return { employeeName: employee.fullName, personalEmail: employee.email, token: renewed.token, expiresAt };
    });
    return { expiresAt: result.expiresAt, notificationStatus: await sendSafely({ ...result, kind: 'extension' }) };
  }

  async cancel(input: { tenantId: string; employeeId: string; actorUserId: string }) {
    const now = new Date();
    return withTenantTransaction(input.tenantId, async (tx) => {
      const [request] = await tx.select().from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.employeeId, input.employeeId))).limit(1);
      if (!request) throw new DocumentOnboardingError('Solicitação não encontrada.', 404);
      if (request.hasUploads) throw new DocumentOnboardingError('Após o primeiro arquivo, o fluxo não pode voltar ao modo legado.', 409);
      await tx.update(documentOnboardingRequests).set({ status: 'cancelled', cancelledAt: now, updatedAt: now }).where(eq(documentOnboardingRequests.id, request.id));
      await tx.update(employees).set({ documentationMode: 'legacy', documentationStatus: 'legacy', updatedAt: now }).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId)));
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: input.tenantId, actorUserId: input.actorUserId, eventType: 'documentation.cancelled', entityType: 'employee', entityId: input.employeeId, metadata: { requestId: request.id }, occurredAt: now });
      return { cancelled: true as const };
    });
  }
}
