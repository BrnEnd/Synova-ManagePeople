import { z } from 'zod';
import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { isBlobStorageConfigured } from '@/lib/documents/storage';
import { completeOnboardingBlobUpload } from '@/lib/document-onboarding/upload-completion';

const bodySchema = z.object({ itemKey: z.string().min(1).max(80), originalName: z.string().min(1).max(255), pathname: z.string().min(1).max(1024) }).strict();

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  if (!isBlobStorageConfigured()) return Response.json({ error: 'Blob não configurado.' }, { status: 409 });
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return Response.json({ error: 'Dados inválidos.' }, { status: 422 });
  try {
    const { token } = await context.params;
    const recorded = await completeOnboardingBlobUpload({ token, ...parsedBody.data }, {
      onboarding: getDocumentOnboardingService(),
    });
    return Response.json({ documentId: recorded.document.id });
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
