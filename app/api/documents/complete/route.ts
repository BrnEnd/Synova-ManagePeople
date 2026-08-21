import { z } from 'zod';
import { InvalidDocumentError, documentPathPrefix } from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { documentMetadata, isBlobStorageConfigured } from '@/lib/documents/storage';
import { getCurrentIdentity } from '@/lib/identity/server';
import { getEmployeesModule } from '@/lib/employees/server';
import { getFinanceModule } from '@/lib/finance/server';

const completionSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(['identification', 'address_proof', 'contract', 'invoice', 'payment_receipt', 'other']),
  originalName: z.string().trim().min(1).max(255),
  pathname: z.string().min(1).max(1024),
  competenceId: z.uuid().optional(),
}).strict();

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  if (!identity || identity.mustChangePassword) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
  if (!isBlobStorageConfigured()) return Response.json({ error: 'Blob não configurado.' }, { status: 409 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = completionSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do documento inválidos.' }, { status: 422 });
  if (identity.role === 'manager') {
    if (parsed.data.type === 'invoice' || !await getEmployeesModule().get(identity.tenantId, parsed.data.employeeId)) return Response.json({ error: 'Contexto do documento inválido.' }, { status: 422 });
  } else {
    if (parsed.data.type !== 'invoice' || !parsed.data.competenceId) return Response.json({ error: 'Contexto do documento inválido.' }, { status: 422 });
    try { const context = await getFinanceModule().invoiceContext(identity.tenantId, identity.id, parsed.data.competenceId); if (context.employeeId !== parsed.data.employeeId) throw new Error(); } catch { return Response.json({ error: 'Contexto do documento inválido.' }, { status: 422 }); }
  }
  if (!parsed.data.pathname.startsWith(documentPathPrefix(identity.tenantId, parsed.data.employeeId))) {
    return Response.json({ error: 'Caminho do documento inválido.' }, { status: 422 });
  }
  try {
    const metadata = await documentMetadata(parsed.data.pathname);
    if (!metadata) return Response.json({ error: 'Documento não encontrado no storage.' }, { status: 404 });
    const result = await getDocumentsModule().recordUpload({
      tenantId: identity.tenantId,
      employeeId: parsed.data.employeeId,
      actorUserId: identity.id,
      type: parsed.data.type,
      origin: identity.role,
      originalName: parsed.data.originalName,
      ...metadata,
    });
    if (identity.role === 'employee' && parsed.data.competenceId) await getFinanceModule().linkInvoice({ tenantId: identity.tenantId, userId: identity.id, competenceId: parsed.data.competenceId, documentId: result.document.id });
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 });
    console.error('Falha ao concluir documento:', error);
    return Response.json({ error: 'Não foi possível concluir o documento.' }, { status: 500 });
  }
}
