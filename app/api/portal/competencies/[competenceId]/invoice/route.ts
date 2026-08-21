import { randomUUID } from 'node:crypto';
import { InvalidDocumentError, documentPathPrefix, validateDocumentFile } from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { isBlobStorageConfigured, safeDocumentName, writeLocalDocument } from '@/lib/documents/storage';
import { getFinanceModule } from '@/lib/finance/server';
import { authorizedEmployee } from '@/lib/timekeeping/http';
export async function POST(request: Request, context: { params: Promise<{ competenceId: string }> }) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  if (isBlobStorageConfigured()) return Response.json({ error: 'Use o upload direto configurado.' }, { status: 409 });
  try { const { competenceId } = await context.params; const invoiceContext = await getFinanceModule().invoiceContext(identity.tenantId, identity.id, competenceId); const form = await request.formData(); const file = form.get('file'); if (!(file instanceof File)) return Response.json({ error: 'Selecione a Nota Fiscal.' }, { status: 422 }); validateDocumentFile({ mimeType: file.type, size: file.size }); const pathname = `${documentPathPrefix(identity.tenantId, invoiceContext.employeeId)}competencies/${competenceId}/${randomUUID()}-${safeDocumentName(file.name)}`; await writeLocalDocument(pathname, new Uint8Array(await file.arrayBuffer())); const result = await getDocumentsModule().recordUpload({ tenantId: identity.tenantId, employeeId: invoiceContext.employeeId, actorUserId: identity.id, type: 'invoice', origin: 'employee', originalName: file.name, pathname, mimeType: file.type, size: file.size }); await getFinanceModule().linkInvoice({ tenantId: identity.tenantId, userId: identity.id, competenceId, documentId: result.document.id }); return Response.json(result, { status: 201 }); }
  catch (error) { if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 }); console.error('Falha ao enviar NF:', error); return Response.json({ error: error instanceof Error ? error.message : 'Não foi possível enviar a Nota Fiscal.' }, { status: 422 }); }
}
