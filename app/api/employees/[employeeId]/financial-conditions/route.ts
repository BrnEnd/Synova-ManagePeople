import { getWorkforceModule } from '@/lib/workforce/server';
import { authorizedWorkforceManager, jsonPayload, workforceError } from '@/lib/workforce/http';
import { rateConditionSchema } from '@/lib/workforce/validation';

export async function POST(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const { identity, response } = await authorizedWorkforceManager(); if (!identity) return response;
  const body = await jsonPayload(request); if (body.response) return body.response;
  const parsed = rateConditionSchema.safeParse(body.payload); if (!parsed.success) return Response.json({ error: 'Condição financeira inválida.' }, { status: 422 });
  try {
    const { employeeId } = await context.params;
    const condition = await getWorkforceModule().addFinancialCondition({ tenantId: identity.tenantId, employeeId, actorUserId: identity.id, ...parsed.data });
    return Response.json({ condition }, { status: 201 });
  } catch (error) { return workforceError(error, 'Não foi possível registrar a condição financeira.'); }
}
