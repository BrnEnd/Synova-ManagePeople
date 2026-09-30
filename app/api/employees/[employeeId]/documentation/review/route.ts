import { z } from 'zod';
import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const bodySchema = z.object({ itemId: z.uuid(), decision: z.enum(['approve', 'reject']), reason: z.string().trim().max(500).optional() }).strict();

export async function POST(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Decisão de revisão inválida.' }, { status: 422 });
  try {
    const { employeeId } = await context.params;
    return Response.json(await getDocumentOnboardingService().review({ tenantId: identity.tenantId, employeeId, actorUserId: identity.id, ...parsed.data }));
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
