import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { approvalError, authorizedManager } from '@/lib/approvals/http';
import { InvalidDocumentError, documentPathPrefix, validateDocumentFile } from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { isBlobStorageConfigured, safeDocumentName, writeLocalDocument } from '@/lib/documents/storage';
import { getFinanceModule } from '@/lib/finance/server';
const jsonSchema = z.object({ receiptDocumentId: z.uuid(), notes: z.string().trim().max(2000).nullable().optional(), paidDate: z.iso.date().nullable().optional() }).strict();
export async function POST(request: Request, context: { params: Promise<{ competenceId: string }> }) {
  const { identity, response } = await authorizedManager(); if (!identity) return response; const { competenceId } = await context.params;
  try {
    if (request.headers.get('content-type')?.includes('application/json')) { const parsed = jsonSchema.safeParse(await request.json()); if (!parsed.success) return Response.json({ error: 'Dados do pagamento inválidos.' }, { status: 422 }); return Response.json({ payment: await getFinanceModule().recordPayment({ tenantId: identity.tenantId, managerUserId: identity.id, competenceId, ...parsed.data }) }, { status: 201 }); }
    if (isBlobStorageConfigured()) return Response.json({ error: 'Use o upload direto configurado.' }, { status: 409 });
    const forecast = await getFinanceModule().ensureForecast(identity.tenantId, competenceId); void forecast;
    const form = await request.formData(); const file = form.get('file'); if (!(file instanceof File)) return Response.json({ error: 'Selecione o comprovante.' }, { status: 422 }); validateDocumentFile({ mimeType: file.type, size: file.size });
    const data = await getFinanceModule().getForecastData(identity.tenantId, competenceId); if (!data) return Response.json({ error: 'Competência não encontrada.' }, { status: 404 });
    const pathname = `${documentPathPrefix(identity.tenantId, data.employeeId)}competencies/${competenceId}/${randomUUID()}-${safeDocumentName(file.name)}`; await writeLocalDocument(pathname, new Uint8Array(await file.arrayBuffer())); const result = await getDocumentsModule().recordUpload({ tenantId: identity.tenantId, employeeId: data.employeeId, actorUserId: identity.id, type: 'payment_receipt', origin: 'manager', originalName: file.name, pathname, mimeType: file.type, size: file.size }); const payment = await getFinanceModule().recordPayment({ tenantId: identity.tenantId, managerUserId: identity.id, competenceId, receiptDocumentId: result.document.id, notes: String(form.get('notes') || ''), paidDate: String(form.get('paidDate') || '') || null }); return Response.json({ payment }, { status: 201 });
  } catch (error) { if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 }); return approvalError(error, 'Não foi possível registrar o pagamento.'); }
}
