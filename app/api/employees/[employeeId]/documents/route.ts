import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  InvalidDocumentError,
  documentPathPrefix,
  validateDocumentFile,
} from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { isBlobStorageConfigured, safeDocumentName, writeLocalDocument } from '@/lib/documents/storage';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const typeSchema = z.enum(['identification', 'address_proof', 'other']);

export async function POST(request: Request, context: RouteContext<'/api/employees/[employeeId]/documents'>) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) {
    return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  }
  if (isBlobStorageConfigured()) {
    return Response.json({ error: 'Use o upload direto configurado para documentos.' }, { status: 409 });
  }
  const { employeeId } = await context.params;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const parsedType = typeSchema.safeParse(form.get('type'));
    if (!(file instanceof File) || !parsedType.success) {
      return Response.json({ error: 'Arquivo e tipo são obrigatórios.' }, { status: 422 });
    }
    validateDocumentFile({ mimeType: file.type, size: file.size });
    const pathname = `${documentPathPrefix(identity.tenantId, employeeId)}${randomUUID()}-${safeDocumentName(file.name)}`;
    await writeLocalDocument(pathname, new Uint8Array(await file.arrayBuffer()));
    const result = await getDocumentsModule().recordUpload({
      tenantId: identity.tenantId,
      employeeId,
      actorUserId: identity.id,
      type: parsedType.data,
      origin: 'manager',
      originalName: file.name,
      pathname,
      mimeType: file.type,
      size: file.size,
    });
    return Response.json(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvalidDocumentError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Error && error.message === 'Funcionário não encontrado.') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Falha ao enviar documento local:', error);
    return Response.json({ error: 'Não foi possível enviar o documento.' }, { status: 500 });
  }
}
