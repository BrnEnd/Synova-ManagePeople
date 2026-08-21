import { getWorkforceModule } from '@/lib/workforce/server';
import { authorizedWorkforceManager, jsonPayload, workforceError } from '@/lib/workforce/http';
import { endPeriodSchema } from '@/lib/workforce/validation';

export async function POST(request: Request, context: { params: Promise<{ contractId: string }> }) {
  const { identity, response } = await authorizedWorkforceManager(); if (!identity) return response;
  const body = await jsonPayload(request); if (body.response) return body.response;
  const parsed = endPeriodSchema.safeParse(body.payload); if (!parsed.success) return Response.json({ error: 'Data de encerramento inválida.' }, { status: 422 });
  try {
    const { contractId } = await context.params;
    const contract = await getWorkforceModule().endContract({ tenantId: identity.tenantId, contractId, actorUserId: identity.id, ...parsed.data });
    return Response.json({ contract });
  } catch (error) { return workforceError(error, 'Não foi possível encerrar o contrato.'); }
}
