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

export async function GET() {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  return Response.json({ clients: await getClientsModule().list(identity.tenantId) });
}

export async function POST(request: Request) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const parsed = clientProfileSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do cliente inválidos.' }, { status: 422 });
  try {
    const client = await getClientsModule().create({ tenantId: identity.tenantId, actorUserId: identity.id, profile: parsed.data });
    return Response.json({ client }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidClientError) return Response.json({ error: error.message }, { status: 422 });
    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return Response.json({ error: 'Já existe um cliente com este CNPJ.' }, { status: 409 });
    }
    console.error('Falha ao criar cliente:', error);
    return Response.json({ error: 'Não foi possível criar o cliente.' }, { status: 500 });
  }
}
