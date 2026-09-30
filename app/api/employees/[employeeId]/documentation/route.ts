import { z } from 'zod';
import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const bodySchema = z.object({ employmentType: z.enum(['clt', 'pj']) }).strict();

export async function POST(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Selecione CLT ou PJ.' }, { status: 422 });
  try {
    const { employeeId } = await context.params;
    const result = await getDocumentOnboardingService().create({ tenantId: identity.tenantId, employeeId, actorUserId: identity.id, employmentType: parsed.data.employmentType });
    return Response.json(result, { status: 201 });
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
