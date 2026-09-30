import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import {
  auditEvents,
  documentOnboardingFiles,
  documentOnboardingItems,
  documentOnboardingRequests,
  documents,
  employees,
  type DocumentOnboardingFormData,
} from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import {
  canUploadOnboardingItem,
  onboardingChecklist,
  requiredOnboardingItemKeys,
  validateOnboardingSubmission,
  type OnboardingEmploymentType,
} from '@/lib/document-onboarding/domain';
import { sendDocumentationEmail } from '@/lib/document-onboarding/email';
import { createOnboardingToken, parseOnboardingToken } from '@/lib/document-onboarding/token';
import { recordDocumentUpload } from '@/lib/documents/postgres-repository';
import { documentPathPrefix, type EmployeeDocument } from '@/lib/documents/module';
import {
  authorizedPublicDetail,
  DocumentOnboardingError,
  employmentType,
  expiryFrom,
  itemStatus,
  notifyManagers,
  type PublicOnboardingDetail,
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

export class DocumentOnboardingPublicService {
  async create(input: { tenantId: string; employeeId: string; actorUserId: string; employmentType: OnboardingEmploymentType }) {
    const now = new Date();
    const requestId = randomUUID();
    const { token, tokenHash } = createOnboardingToken(input.tenantId, requestId);
    const expiresAt = expiryFrom(now);
    const result = await withTenantTransaction(input.tenantId, async (tx) => {
      const [employee] = await tx.select().from(employees).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId))).limit(1);
      if (!employee) throw new DocumentOnboardingError('Funcionário não encontrado.', 404);
      if (employee.status !== 'pre_registration' || employee.userId) {
        throw new DocumentOnboardingError('A admissão digital está disponível somente para novos pré-cadastros sem acesso ao portal.', 409);
      }
      if (!employee.email) throw new DocumentOnboardingError('Cadastre o e-mail pessoal antes de solicitar os documentos.');
      const [existing] = await tx.select().from(documentOnboardingRequests).where(and(
        eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.employeeId, input.employeeId),
      )).limit(1);
      if (existing) {
        if (existing.status !== 'cancelled' || existing.hasUploads) throw new DocumentOnboardingError('Já existe uma solicitação de documentação para este funcionário.', 409);
        await tx.delete(documentOnboardingItems).where(and(eq(documentOnboardingItems.tenantId, input.tenantId), eq(documentOnboardingItems.requestId, existing.id)));
        await tx.delete(documentOnboardingRequests).where(and(eq(documentOnboardingRequests.tenantId, input.tenantId), eq(documentOnboardingRequests.id, existing.id)));
      }
      await tx.insert(documentOnboardingRequests).values({
        id: requestId, tenantId: input.tenantId, employeeId: input.employeeId, employmentType: input.employmentType,
        status: 'in_progress', tokenHash, expiresAt, lastSentAt: now, data: {}, revision: 1,
        hasUploads: false, createdByUserId: input.actorUserId, createdAt: now, updatedAt: now,
      });
      await tx.insert(documentOnboardingItems).values(onboardingChecklist(input.employmentType).map((item, position) => ({
        id: randomUUID(), tenantId: input.tenantId, requestId, key: item.key, label: item.label,
        required: item.required, status: 'pending', position, createdAt: now, updatedAt: now,
      })));
      await tx.update(employees).set({
        employmentType: input.employmentType, documentationMode: 'self_service', documentationStatus: 'in_progress', updatedAt: now,
      }).where(and(eq(employees.tenantId, input.tenantId), eq(employees.id, input.employeeId)));
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: input.tenantId, actorUserId: input.actorUserId,
        eventType: 'documentation.requested', entityType: 'employee', entityId: input.employeeId,
        metadata: { requestId, employmentType: input.employmentType, expiresAt: expiresAt.toISOString() }, occurredAt: now,
      });
      return { employeeName: employee.fullName, personalEmail: employee.email };
    });
    return { requestId, expiresAt, notificationStatus: await sendSafely({ ...result, token, expiresAt, kind: 'request' }) };
  }

  async getPublic(token: string): Promise<Omit<PublicOnboardingDetail, 'blobEnabled'>> {
    const parsed = parseOnboardingToken(token);
    if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
    try {
      return await withTenantTransaction(parsed.tenantId, async (tx) => {
        const { detail, employee } = await authorizedPublicDetail(tx, token);
        return { employee, request: detail.request, items: detail.items };
      });
    } catch (error) {
      if (error instanceof DocumentOnboardingError && error.status === 410) {
        const now = new Date();
        await withTenantTransaction(parsed.tenantId, async (tx) => {
          const [request] = await tx.select({ employeeId: documentOnboardingRequests.employeeId, status: documentOnboardingRequests.status }).from(documentOnboardingRequests).where(and(
            eq(documentOnboardingRequests.tenantId, parsed.tenantId), eq(documentOnboardingRequests.id, parsed.requestId), lte(documentOnboardingRequests.expiresAt, now),
          )).limit(1);
          if (request && ['in_progress', 'changes_requested'].includes(request.status)) {
            await tx.update(documentOnboardingRequests).set({ status: 'expired', updatedAt: now }).where(and(eq(documentOnboardingRequests.tenantId, parsed.tenantId), eq(documentOnboardingRequests.id, parsed.requestId)));
            await tx.update(employees).set({ documentationStatus: 'expired', updatedAt: now }).where(and(eq(employees.tenantId, parsed.tenantId), eq(employees.id, request.employeeId)));
          }
        });
      }
      throw error;
    }
  }

  async saveDraft(token: string, data: DocumentOnboardingFormData) {
    const parsed = parseOnboardingToken(token);
    if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
    return withTenantTransaction(parsed.tenantId, async (tx) => {
      const { detail } = await authorizedPublicDetail(tx, token);
      if (!['in_progress', 'changes_requested'].includes(detail.request.status)) throw new DocumentOnboardingError('O formulário está bloqueado após o envio.', 409);
      if (detail.request.status === 'changes_requested') return detail.request.data;
      const [updated] = await tx.update(documentOnboardingRequests).set({ data, updatedAt: new Date() }).where(and(
        eq(documentOnboardingRequests.tenantId, parsed.tenantId), eq(documentOnboardingRequests.id, parsed.requestId),
      )).returning({ data: documentOnboardingRequests.data });
      return updated?.data ?? data;
    });
  }

  async linkDocument(token: string, itemKey: string, documentId: string) {
    const parsed = parseOnboardingToken(token);
    if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
    const now = new Date();
    return withTenantTransaction(parsed.tenantId, async (tx) => {
      const { detail } = await authorizedPublicDetail(tx, token, now);
      if (!['in_progress', 'changes_requested'].includes(detail.request.status)) throw new DocumentOnboardingError('O formulário está bloqueado após o envio.', 409);
      const request = detail.rawRequest;
      const [item] = await tx.select().from(documentOnboardingItems).where(and(
        eq(documentOnboardingItems.tenantId, parsed.tenantId), eq(documentOnboardingItems.requestId, parsed.requestId), eq(documentOnboardingItems.key, itemKey),
      )).limit(1);
      const [document] = await tx.select().from(documents).where(and(eq(documents.tenantId, parsed.tenantId), eq(documents.id, documentId), eq(documents.employeeId, request.employeeId))).limit(1);
      if (!item || !document) throw new DocumentOnboardingError('Documento ou item inválido.', 404);
      const [existingLink] = await tx.select({ id: documentOnboardingFiles.id }).from(documentOnboardingFiles).where(and(eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.documentId, documentId))).limit(1);
      if (existingLink) return { itemId: item.id, status: 'uploaded' as const };
      if (!canUploadOnboardingItem(detail.request.status, itemStatus(item.status), item.reviewable)) throw new DocumentOnboardingError('Este item não está disponível para envio nesta etapa.', 409);
      const definition = onboardingChecklist(employmentType(request.employmentType)).find((candidate) => candidate.key === itemKey);
      if (!definition || document.type !== definition.documentType) throw new DocumentOnboardingError('Tipo de documento incompatível com o item.');
      const [{ maxVersion }] = await tx.select({ maxVersion: sql<number>`coalesce(max(${documentOnboardingFiles.version}), 0)` }).from(documentOnboardingFiles).where(and(eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.itemId, item.id)));
      const version = item.status === 'rejected' ? Number(maxVersion) + 1 : Math.max(1, Number(maxVersion));
      if (item.status === 'rejected') await tx.update(documentOnboardingFiles).set({ active: false }).where(and(eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.itemId, item.id)));
      await tx.insert(documentOnboardingFiles).values({ id: randomUUID(), tenantId: parsed.tenantId, requestId: parsed.requestId, itemId: item.id, documentId, version, active: true, createdAt: now });
      await tx.update(documentOnboardingItems).set({ status: 'uploaded', reviewable: false, rejectionReason: null, reviewedAt: null, reviewedByUserId: null, updatedAt: now }).where(eq(documentOnboardingItems.id, item.id));
      await tx.update(documentOnboardingRequests).set({ hasUploads: true, updatedAt: now }).where(eq(documentOnboardingRequests.id, parsed.requestId));
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: parsed.tenantId, actorUserId: null, eventType: 'documentation.document_linked', entityType: 'employee', entityId: request.employeeId, metadata: { requestId: parsed.requestId, itemId: item.id, itemKey, documentId, origin: 'employee_link' }, occurredAt: now });
      return { itemId: item.id, status: 'uploaded' as const };
    });
  }

  async completeStoredDocument(input: {
    token: string;
    itemKey: string;
    originalName: string;
    pathname: string;
    mimeType: string;
    size: number;
    expected?: { tenantId: string; employeeId: string; documentType: EmployeeDocument['type'] };
  }) {
    const parsed = parseOnboardingToken(input.token);
    if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
    const now = new Date();
    return withTenantTransaction(parsed.tenantId, async (tx) => {
      await tx.execute(sql`select id from document_onboarding_requests where tenant_id = ${parsed.tenantId} and id = ${parsed.requestId} for update`);
      const { detail } = await authorizedPublicDetail(tx, input.token, now);
      const request = detail.rawRequest;
      const definition = onboardingChecklist(detail.request.employmentType).find((candidate) => candidate.key === input.itemKey);
      const item = detail.items.find((candidate) => candidate.key === input.itemKey);
      if (!definition || !item || !canUploadOnboardingItem(detail.request.status, item.status, item.reviewable)) {
        throw new DocumentOnboardingError('Este item não está disponível para envio nesta etapa.', 409);
      }
      if (!input.pathname.startsWith(documentPathPrefix(parsed.tenantId, request.employeeId))) {
        throw new DocumentOnboardingError('Contexto inválido.', 422);
      }
      if (input.expected && (
        input.expected.tenantId !== parsed.tenantId
        || input.expected.employeeId !== request.employeeId
        || input.expected.documentType !== definition.documentType
      )) throw new DocumentOnboardingError('Contexto assinado inválido.', 422);

      const recorded = await recordDocumentUpload(tx, {
        id: randomUUID(), tenantId: parsed.tenantId, employeeId: request.employeeId,
        type: definition.documentType, origin: 'employee', originalName: input.originalName,
        pathname: input.pathname, mimeType: input.mimeType, size: input.size,
        uploadedByUserId: null, createdAt: now, archivedAt: null,
      });
      const [existingLink] = await tx.select({ id: documentOnboardingFiles.id }).from(documentOnboardingFiles).where(and(
        eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.documentId, recorded.document.id),
      )).limit(1);
      if (existingLink) return recorded;
      const [storedItem] = await tx.select().from(documentOnboardingItems).where(and(
        eq(documentOnboardingItems.tenantId, parsed.tenantId), eq(documentOnboardingItems.requestId, parsed.requestId), eq(documentOnboardingItems.key, input.itemKey),
      )).limit(1);
      if (!storedItem || !canUploadOnboardingItem(detail.request.status, itemStatus(storedItem.status), storedItem.reviewable)) {
        throw new DocumentOnboardingError('Este item não está disponível para envio nesta etapa.', 409);
      }
      const [{ maxVersion }] = await tx.select({ maxVersion: sql<number>`coalesce(max(${documentOnboardingFiles.version}), 0)` }).from(documentOnboardingFiles).where(and(
        eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.itemId, storedItem.id),
      ));
      const version = storedItem.status === 'rejected' ? Number(maxVersion) + 1 : Math.max(1, Number(maxVersion));
      if (storedItem.status === 'rejected') await tx.update(documentOnboardingFiles).set({ active: false }).where(and(eq(documentOnboardingFiles.tenantId, parsed.tenantId), eq(documentOnboardingFiles.itemId, storedItem.id)));
      await tx.insert(documentOnboardingFiles).values({ id: randomUUID(), tenantId: parsed.tenantId, requestId: parsed.requestId, itemId: storedItem.id, documentId: recorded.document.id, version, active: true, createdAt: now });
      await tx.update(documentOnboardingItems).set({ status: 'uploaded', reviewable: false, rejectionReason: null, reviewedAt: null, reviewedByUserId: null, updatedAt: now }).where(eq(documentOnboardingItems.id, storedItem.id));
      await tx.update(documentOnboardingRequests).set({ hasUploads: true, updatedAt: now }).where(eq(documentOnboardingRequests.id, parsed.requestId));
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: parsed.tenantId, actorUserId: null, eventType: 'documentation.document_linked', entityType: 'employee', entityId: request.employeeId, metadata: { requestId: parsed.requestId, itemId: storedItem.id, itemKey: input.itemKey, documentId: recorded.document.id, origin: 'employee_link' }, occurredAt: now });
      return recorded;
    });
  }

  async submit(token: string) {
    const parsed = parseOnboardingToken(token);
    if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
    const now = new Date();
    await withTenantTransaction(parsed.tenantId, async (tx) => {
      const { detail, employee } = await authorizedPublicDetail(tx, token, now);
      if (!['in_progress', 'changes_requested'].includes(detail.request.status)) throw new DocumentOnboardingError('O formulário já foi enviado.', 409);
      const statuses = Object.fromEntries(detail.items.map((item) => [item.key, item.status]));
      const errors = validateOnboardingSubmission({ employmentType: detail.request.employmentType, data: detail.request.data, itemStatuses: statuses });
      if (errors.length) throw new DocumentOnboardingError(errors.join(' '));
      const required = requiredOnboardingItemKeys(detail.request.employmentType, detail.request.data);
      const optionalPending = detail.items.filter((item) => !required.has(item.key) && item.status === 'pending').map((item) => item.id);
      if (optionalPending.length) await tx.update(documentOnboardingItems).set({ status: 'not_applicable', reviewable: false, updatedAt: now }).where(and(eq(documentOnboardingItems.tenantId, parsed.tenantId), inArray(documentOnboardingItems.id, optionalPending)));
      await tx.update(documentOnboardingItems).set({ reviewable: true, updatedAt: now }).where(and(eq(documentOnboardingItems.tenantId, parsed.tenantId), eq(documentOnboardingItems.requestId, parsed.requestId), eq(documentOnboardingItems.status, 'uploaded')));
      await tx.update(documentOnboardingRequests).set({ status: 'submitted', submittedAt: now, updatedAt: now }).where(eq(documentOnboardingRequests.id, parsed.requestId));
      const [request] = await tx.select({ employeeId: documentOnboardingRequests.employeeId, revision: documentOnboardingRequests.revision }).from(documentOnboardingRequests).where(eq(documentOnboardingRequests.id, parsed.requestId)).limit(1);
      await tx.update(employees).set({ documentationStatus: 'submitted', updatedAt: now }).where(and(eq(employees.tenantId, parsed.tenantId), eq(employees.id, request.employeeId)));
      await notifyManagers(tx, { tenantId: parsed.tenantId, employeeId: request.employeeId, type: detail.request.revision > 1 ? 'documentation.corrected' : 'documentation.submitted', title: detail.request.revision > 1 ? 'Documentos corrigidos' : 'Documentos enviados', message: `${employee.fullName} enviou a documentação para revisão.`, key: `documentation-submitted:${parsed.requestId}:${request.revision}` });
      await tx.insert(auditEvents).values({ id: randomUUID(), tenantId: parsed.tenantId, actorUserId: null, eventType: 'documentation.submitted', entityType: 'employee', entityId: request.employeeId, metadata: { requestId: parsed.requestId, revision: request.revision }, occurredAt: now });
    });
    return { submitted: true as const };
  }
}
