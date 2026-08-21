import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { z } from 'zod';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  documentPathPrefix,
} from '@/lib/documents/module';
import { getDocumentsModule } from '@/lib/documents/server';
import { documentMetadata } from '@/lib/documents/storage';
import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';
import { getFinanceModule } from '@/lib/finance/server';

const payloadSchema = z.object({
  employeeId: z.uuid(),
  type: z.enum(['identification', 'address_proof', 'contract', 'invoice', 'payment_receipt', 'other']),
  originalName: z.string().trim().min(1).max(255),
  competenceId: z.uuid().optional(),
}).strict();

const tokenPayloadSchema = payloadSchema.extend({
  tenantId: z.uuid(),
  actorUserId: z.uuid(),
  pathname: z.string().min(1),
  origin: z.enum(['manager', 'employee']),
}).strict();

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const identity = await getCurrentIdentity();
        if (!identity || identity.mustChangePassword) throw new Error('Não autorizado.');
        const parsed = payloadSchema.safeParse(clientPayload ? JSON.parse(clientPayload) : null);
        if (!parsed.success) throw new Error('Contexto do documento inválido.');
        if (managerAccess(identity) === 'allowed') {
          if (parsed.data.type === 'invoice') throw new Error('A Nota Fiscal deve ser enviada pelo funcionário.');
          const employee = await getEmployeesModule().get(identity.tenantId, parsed.data.employeeId);
          if (!employee) throw new Error('Funcionário não encontrado.');
        } else {
          if (identity.role !== 'employee' || parsed.data.type !== 'invoice' || !parsed.data.competenceId) throw new Error('Não autorizado.');
          const context = await getFinanceModule().invoiceContext(identity.tenantId, identity.id, parsed.data.competenceId);
          if (context.employeeId !== parsed.data.employeeId) throw new Error('Contexto do documento inválido.');
        }
        const prefix = documentPathPrefix(identity.tenantId, parsed.data.employeeId);
        if (!pathname.startsWith(prefix)) throw new Error('Caminho do documento inválido.');
        return {
          allowedContentTypes: [...ALLOWED_DOCUMENT_MIME_TYPES],
          maximumSizeInBytes: MAX_DOCUMENT_SIZE,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({
            ...parsed.data,
            tenantId: identity.tenantId,
            actorUserId: identity.id,
            pathname,
            origin: identity.role,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = tokenPayloadSchema.safeParse(tokenPayload ? JSON.parse(tokenPayload) : null);
        if (!parsed.success || parsed.data.pathname !== blob.pathname) {
          throw new Error('Contexto assinado do documento inválido.');
        }
        const metadata = await documentMetadata(blob.pathname);
        if (!metadata) throw new Error('Documento não encontrado no storage.');
        await getDocumentsModule().recordUpload({
          tenantId: parsed.data.tenantId,
          employeeId: parsed.data.employeeId,
          actorUserId: parsed.data.actorUserId,
          type: parsed.data.type,
          origin: parsed.data.origin,
          originalName: parsed.data.originalName,
          ...metadata,
        });
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error('Falha no upload direto de documento:', error);
    return Response.json({ error: 'Não foi possível autorizar o upload.' }, { status: 400 });
  }
}
