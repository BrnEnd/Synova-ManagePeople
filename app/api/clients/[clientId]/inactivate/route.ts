import { getClientsModule } from '@/lib/clients/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function POST(_request: Request, context: RouteContext<'/api/clients/[clientId]/inactivate'>) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  const { clientId } = await context.params;
  try {
    const client = await getClientsModule().inactivate({ tenantId: identity.tenantId, clientId, actorUserId: identity.id });
    return Response.json({ client });
  } catch (error) {
    if (error instanceof Error && error.message === 'Cliente não encontrado.') return Response.json({ error: error.message }, { status: 404 });
    console.error('Falha ao inativar cliente:', error);
    return Response.json({ error: 'Não foi possível inativar o cliente.' }, { status: 500 });
  }
}
