import { randomUUID } from 'node:crypto';
import { canUploadOnboardingItem, onboardingChecklist } from '@/lib/document-onboarding/domain';
import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { InvalidDocumentError, documentPathPrefix, validateDocumentFile } from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { isBlobStorageConfigured, safeDocumentName, writeLocalDocument } from '@/lib/documents/storage';

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (isBlobStorageConfigured()) return Response.json({ error: 'Use o upload direto configurado.' }, { status: 409 });
  try {
    const { token } = await context.params;
    const onboarding = getDocumentOnboardingService();
    const detail = await onboarding.getPublic(token);
    const form = await request.formData();
    const file = form.get('file');
    const itemKey = String(form.get('itemKey') || '');
    const definition = onboardingChecklist(detail.request.employmentType).find((item) => item.key === itemKey);
    const item = detail.items.find((candidate) => candidate.key === itemKey);
    if (!(file instanceof File) || !definition || !item) return Response.json({ error: 'Arquivo e item são obrigatórios.' }, { status: 422 });
    if (!canUploadOnboardingItem(detail.request.status, item.status, item.reviewable)) return Response.json({ error: 'Este item não está disponível para envio nesta etapa.' }, { status: 409 });
    validateDocumentFile({ mimeType: file.type, size: file.size });
    const pathname = `${documentPathPrefix(token.split('.')[0], detail.employee.id)}${randomUUID()}-${safeDocumentName(file.name)}`;
    await writeLocalDocument(pathname, new Uint8Array(await file.arrayBuffer()));
    const result = await getDocumentsModule().recordUpload({ tenantId: token.split('.')[0], employeeId: detail.employee.id, actorUserId: null, type: definition.documentType, origin: 'employee', originalName: file.name, pathname, mimeType: file.type, size: file.size });
    await onboarding.linkDocument(token, itemKey, result.document.id);
    return Response.json({ documentId: result.document.id }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 });
    return onboardingErrorResponse(error);
  }
}
