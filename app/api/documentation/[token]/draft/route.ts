import { z } from 'zod';
import { onboardingErrorResponse } from '@/lib/document-onboarding/http';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';

const dependentSchema = z.object({
  id: z.string().min(1).max(80), name: z.string().max(160), birthDate: z.string().max(10), cpf: z.string().max(32),
  relationship: z.string().max(80), incomeTax: z.boolean(), familyAllowance: z.boolean(), specialProofRequired: z.boolean().optional(),
}).strict();
const dataSchema = z.object({
  cpf: z.string().max(32).optional(), phone: z.string().max(32).optional(), gender: z.enum(['male', 'female']).optional(),
  raceColor: z.enum(['white', 'black', 'brown', 'yellow', 'indigenous', 'prefer_not_to_say']).optional(),
  workCardNumber: z.string().max(64).optional(), pisNumber: z.string().max(64).optional(), transportationVoucher: z.boolean().optional(),
  tripsPerDay: z.number().int().positive().optional(), monthlyAdvance: z.boolean().optional(), marriageCertificateNotApplicable: z.boolean().optional(),
  dependents: z.array(dependentSchema).max(30).optional(), truthDeclaration: z.boolean().optional(),
}).strict();

export async function PUT(request: Request, context: { params: Promise<{ token: string }> }) {
  const parsed = dataSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Revise os dados informados.' }, { status: 422 });
  try {
    const { token } = await context.params;
    return Response.json({ data: await getDocumentOnboardingService().saveDraft(token, parsed.data) });
  } catch (error) {
    return onboardingErrorResponse(error);
  }
}
