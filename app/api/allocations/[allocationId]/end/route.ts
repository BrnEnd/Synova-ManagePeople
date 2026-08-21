import { getWorkforceModule } from '@/lib/workforce/server';
import { authorizedWorkforceManager, jsonPayload, workforceError } from '@/lib/workforce/http';
import { endPeriodSchema } from '@/lib/workforce/validation';

export async function POST(request: Request, context: { params: Promise<{ allocationId: string }> }) {
  const { identity, response } = await authorizedWorkforceManager(); if (!identity) return response;
  const body = await jsonPayload(request); if (body.response) return body.response;
  const parsed = endPeriodSchema.safeParse(body.payload); if (!parsed.success) return Response.json({ error: 'Data de encerramento inválida.' }, { status: 422 });
  try {
    const { allocationId } = await context.params;
    const allocation = await getWorkforceModule().endAllocation({ tenantId: identity.tenantId, allocationId, actorUserId: identity.id, ...parsed.data });
    return Response.json({ allocation });
  } catch (error) { return workforceError(error, 'Não foi possível encerrar a alocação.'); }
}
