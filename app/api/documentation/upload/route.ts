import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { z } from 'zod';
import { canUploadOnboardingItem, onboardingChecklist } from '@/lib/document-onboarding/domain';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { ALLOWED_DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE, documentPathPrefix } from '@/lib/documents/module';
import { completeOnboardingBlobUpload } from '@/lib/document-onboarding/upload-completion';

const payloadSchema = z.object({ token: z.string().min(40).max(300), itemKey: z.string().min(1).max(80), originalName: z.string().min(1).max(255) }).strict();
const signedSchema = payloadSchema.extend({ tenantId: z.uuid(), employeeId: z.uuid(), pathname: z.string(), documentType: z.string() }).strict();

export async function POST(request: Request) {
  try {
    const body = await request.json() as HandleUploadBody;
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsed = payloadSchema.safeParse(clientPayload ? JSON.parse(clientPayload) : null);
        if (!parsed.success) throw new Error('Contexto inválido.');
        const detail = await getDocumentOnboardingService().getPublic(parsed.data.token);
        const definition = onboardingChecklist(detail.request.employmentType).find((item) => item.key === parsed.data.itemKey);
        const item = detail.items.find((candidate) => candidate.key === parsed.data.itemKey);
        if (!definition || !item || !canUploadOnboardingItem(detail.request.status, item.status, item.reviewable)) throw new Error('Item indisponível.');
        const tenantId = parsed.data.token.split('.')[0];
        if (!pathname.startsWith(documentPathPrefix(tenantId, detail.employee.id))) throw new Error('Caminho inválido.');
        return { allowedContentTypes: [...ALLOWED_DOCUMENT_MIME_TYPES], maximumSizeInBytes: MAX_DOCUMENT_SIZE, addRandomSuffix: false, allowOverwrite: false, tokenPayload: JSON.stringify({ ...parsed.data, tenantId, employeeId: detail.employee.id, pathname, documentType: definition.documentType }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const parsed = signedSchema.safeParse(tokenPayload ? JSON.parse(tokenPayload) : null);
        if (!parsed.success || parsed.data.pathname !== blob.pathname) throw new Error('Contexto assinado inválido.');
        await completeOnboardingBlobUpload({
          token: parsed.data.token,
          itemKey: parsed.data.itemKey,
          originalName: parsed.data.originalName,
          pathname: blob.pathname,
          expected: {
            tenantId: parsed.data.tenantId,
            employeeId: parsed.data.employeeId,
            documentType: parsed.data.documentType as import('@/lib/documents/module').DocumentType,
          },
        }, {
          onboarding: getDocumentOnboardingService(),
        });
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error('Falha no upload público:', error);
    return Response.json({ error: 'Não foi possível autorizar o upload.' }, { status: 400 });
  }
}
