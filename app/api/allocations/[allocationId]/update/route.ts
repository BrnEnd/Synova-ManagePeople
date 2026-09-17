import { allocationUpdateSchema } from '@/lib/workforce/validation';
import { authorizedWorkforceManager, workforceError } from '@/lib/workforce/http';
import { getWorkforceModule } from '@/lib/workforce/server';

export async function POST(request: Request, context: { params: Promise<{ allocationId: string }> }) {
  const { identity, response } = await authorizedWorkforceManager();
  if (!identity) return response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const parsed = allocationUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Dados da atualização inválidos.' }, { status: 422 });
  try {
    const { allocationId } = await context.params;
    await getWorkforceModule().updateAllocation({ tenantId: identity.tenantId, allocationId, actorUserId: identity.id, ...parsed.data });
    return Response.json({ updated: true });
  } catch (error) { return workforceError(error, 'Não foi possível atualizar a alocação.'); }
}
