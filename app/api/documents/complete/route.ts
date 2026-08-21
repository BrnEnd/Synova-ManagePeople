import { z } from 'zod';
import { InvalidDocumentError, documentPathPrefix } from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { documentMetadata, isBlobStorageConfigured } from '@/lib/documents/storage';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const completionSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(['identification', 'address_proof', 'other']),
  originalName: z.string().trim().min(1).max(255),
  pathname: z.string().min(1).max(1024),
}).strict();

export async function POST(request: Request) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) {
    return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  }
  if (!isBlobStorageConfigured()) return Response.json({ error: 'Blob não configurado.' }, { status: 409 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = completionSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do documento inválidos.' }, { status: 422 });
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
      origin: 'manager',
      originalName: parsed.data.originalName,
      ...metadata,
    });
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 });
    console.error('Falha ao concluir documento:', error);
    return Response.json({ error: 'Não foi possível concluir o documento.' }, { status: 500 });
  }
}
