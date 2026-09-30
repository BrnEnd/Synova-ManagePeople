import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    return Response.json(await getDocumentOnboardingService().submit(token));
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
