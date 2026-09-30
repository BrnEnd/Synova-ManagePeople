import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function POST(_request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  try {
    const { employeeId } = await context.params;
    return Response.json(await getDocumentOnboardingService().renew({ tenantId: identity.tenantId, employeeId, actorUserId: identity.id }));
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
