import { getWorkforceModule } from '@/lib/workforce/server';
import { authorizedWorkforceManager, jsonPayload, workforceError } from '@/lib/workforce/http';
import { contractSchema } from '@/lib/workforce/validation';

export async function POST(request: Request, context: { params: Promise<{ employeeId: string }> }) {
  const { identity, response } = await authorizedWorkforceManager(); if (!identity) return response;
  const body = await jsonPayload(request); if (body.response) return body.response;
  const parsed = contractSchema.safeParse(body.payload); if (!parsed.success) return Response.json({ error: 'Dados do contrato inválidos.' }, { status: 422 });
  try {
    const { employeeId } = await context.params;
    const contract = await getWorkforceModule().createContract({ tenantId: identity.tenantId, employeeId, actorUserId: identity.id, ...parsed.data });
    return Response.json({ contract }, { status: 201 });
  } catch (error) { return workforceError(error, 'Não foi possível criar o contrato.'); }
}
