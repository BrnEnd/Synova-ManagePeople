import { InvalidClientError } from '@/lib/clients/module';
import { getClientsModule } from '@/lib/clients/server';
import { clientProfileSchema } from '@/lib/clients/validation';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

async function authorizedManager() {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  return access === 'allowed' && identity ? { identity, response: null } : {
    identity: null, response: managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access),
  };
}

export async function GET(_request: Request, context: RouteContext<'/api/clients/[clientId]'>) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  const { clientId } = await context.params;
  const client = await getClientsModule().get(identity.tenantId, clientId);
  return client ? Response.json({ client }) : Response.json({ error: 'Cliente não encontrado.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext<'/api/clients/[clientId]'>) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  const { clientId } = await context.params;
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const parsed = clientProfileSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do cliente inválidos.' }, { status: 422 });
  try {
    const client = await getClientsModule().update({ tenantId: identity.tenantId, clientId, actorUserId: identity.id, profile: parsed.data });
    return Response.json({ client });
  } catch (error) {
    if (error instanceof InvalidClientError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Error && error.message === 'Cliente não encontrado.') return Response.json({ error: error.message }, { status: 404 });
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'Já existe um cliente com este CNPJ.' }, { status: 409 });
    }
    console.error('Falha ao atualizar cliente:', error);
    return Response.json({ error: 'Não foi possível atualizar o cliente.' }, { status: 500 });
  }
}
