import { randomUUID } from 'node:crypto';
import { and, eq, gt, inArray, isNull, lte } from 'drizzle-orm';
import {
  auditEvents,
  documentOnboardingFiles,
  documentOnboardingItems,
  documentOnboardingRequests,
  documents,
  employees,
  tenants,
} from '@/lib/db/schema';
import { getProvisioningDb } from '@/lib/db/client';
import { withTenantTransaction } from '@/lib/db/transactions';
import { notifyManagers } from '@/lib/document-onboarding/shared';
import { deleteDocumentStorage } from '@/lib/documents/storage';

export class DocumentOnboardingMaintenanceService {
  async runReminders(now = new Date()) {
    const tenantIds = (await getProvisioningDb().select({ id: tenants.id }).from(tenants).where(eq(tenants.status, 'active'))).map((tenant) => tenant.id);
    const warningLimit = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dateKey = now.toISOString().slice(0, 10);
    let expired = 0;
    let notificationsCreated = 0;
    let purged = 0;
    for (const tenantId of tenantIds) {
      const result = await withTenantTransaction(tenantId, async (tx) => {
        let tenantExpired = 0;
        let tenantNotifications = 0;
        const expiredRequests = await tx.select({ id: documentOnboardingRequests.id, employeeId: documentOnboardingRequests.employeeId }).from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, tenantId), inArray(documentOnboardingRequests.status, ['in_progress', 'changes_requested']), lte(documentOnboardingRequests.expiresAt, now)));
        for (const request of expiredRequests) {
          await tx.update(documentOnboardingRequests).set({ status: 'expired', updatedAt: now }).where(and(eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.id, request.id)));
          await tx.update(employees).set({ documentationStatus: 'expired', updatedAt: now }).where(and(eq(employees.tenantId, tenantId), eq(employees.id, request.employeeId)));
          await notifyManagers(tx, { tenantId, employeeId: request.employeeId, type: 'documentation.expired', title: 'Link de documentação expirado', message: 'O prazo de 15 dias terminou sem a conclusão do envio.', key: `documentation-expired:${request.id}` });
          await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: null, eventType: 'documentation.expired', entityType: 'employee', entityId: request.employeeId, metadata: { requestId: request.id }, occurredAt: now });
          tenantExpired += 1;
          tenantNotifications += 1;
        }
        const expiring = await tx.select({ id: documentOnboardingRequests.id, employeeId: documentOnboardingRequests.employeeId, employeeName: employees.fullName }).from(documentOnboardingRequests).innerJoin(employees, and(eq(employees.tenantId, documentOnboardingRequests.tenantId), eq(employees.id, documentOnboardingRequests.employeeId))).where(and(eq(documentOnboardingRequests.tenantId, tenantId), inArray(documentOnboardingRequests.status, ['in_progress', 'changes_requested']), gt(documentOnboardingRequests.expiresAt, now), lte(documentOnboardingRequests.expiresAt, warningLimit)));
        for (const request of expiring) {
          await notifyManagers(tx, { tenantId, employeeId: request.employeeId, type: 'documentation.expiring', title: 'Link expira em até 3 dias', message: `${request.employeeName} ainda não concluiu a documentação.`, key: `documentation-expiring:${request.id}:${dateKey}` });
          tenantNotifications += 1;
        }
        const pendingReview = await tx.select({ id: documentOnboardingRequests.id, employeeId: documentOnboardingRequests.employeeId, employeeName: employees.fullName }).from(documentOnboardingRequests).innerJoin(employees, and(eq(employees.tenantId, documentOnboardingRequests.tenantId), eq(employees.id, documentOnboardingRequests.employeeId))).where(and(eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.status, 'submitted')));
        for (const request of pendingReview) {
          await notifyManagers(tx, { tenantId, employeeId: request.employeeId, type: 'documentation.review_pending', title: 'Documentação aguardando análise', message: `A documentação de ${request.employeeName} ainda precisa ser revisada.`, key: `documentation-review:${request.id}:${dateKey}` });
          tenantNotifications += 1;
        }
        return { tenantExpired, tenantNotifications };
      });
      expired += result.tenantExpired;
      notificationsCreated += result.tenantNotifications;
      const retentionLimit = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const stale = await withTenantTransaction(tenantId, (tx) => tx.select({ id: documentOnboardingRequests.id, employeeId: documentOnboardingRequests.employeeId }).from(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.status, 'expired'), lte(documentOnboardingRequests.expiresAt, retentionLimit), isNull(documentOnboardingRequests.purgedAt))));
      for (const request of stale) {
        const stored = await withTenantTransaction(tenantId, (tx) => tx.select({ documentId: documents.id, pathname: documents.pathname }).from(documentOnboardingFiles).innerJoin(documents, and(eq(documents.tenantId, documentOnboardingFiles.tenantId), eq(documents.id, documentOnboardingFiles.documentId))).where(and(eq(documentOnboardingFiles.tenantId, tenantId), eq(documentOnboardingFiles.requestId, request.id))));
        try {
          for (const document of stored) await deleteDocumentStorage(document.pathname);
        } catch (error) {
          console.error('Falha ao excluir arquivo expirado de onboarding:', error);
          continue;
        }
        await withTenantTransaction(tenantId, async (tx) => {
          await tx.delete(documentOnboardingFiles).where(and(eq(documentOnboardingFiles.tenantId, tenantId), eq(documentOnboardingFiles.requestId, request.id)));
          if (stored.length) await tx.update(documents).set({ archivedAt: now }).where(and(eq(documents.tenantId, tenantId), inArray(documents.id, stored.map((document) => document.documentId))));
          await tx.update(documentOnboardingItems).set({ status: 'pending', reviewable: false, rejectionReason: null, reviewedByUserId: null, reviewedAt: null, updatedAt: now }).where(and(eq(documentOnboardingItems.tenantId, tenantId), eq(documentOnboardingItems.requestId, request.id)));
          await tx.update(documentOnboardingRequests).set({ data: {}, purgedAt: now, updatedAt: now }).where(and(eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.id, request.id)));
          await tx.insert(auditEvents).values({ id: randomUUID(), tenantId, actorUserId: null, eventType: 'documentation.expired_draft_purged', entityType: 'employee', entityId: request.employeeId, metadata: { requestId: request.id, documents: stored.length, retentionDays: 90 }, occurredAt: now });
        });
        purged += 1;
      }
    }
    return { tenants: tenantIds.length, expired, purged, notifications: notificationsCreated };
  }
}
