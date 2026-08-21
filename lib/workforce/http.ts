import { InvalidWorkforceError } from '@/lib/workforce/module';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function authorizedWorkforceManager() {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  return access === 'allowed' && identity ? { identity, response: null } : {
    identity: null, response: managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access),
  };
}

export function workforceError(error: unknown, fallback: string) {
  if (error instanceof InvalidWorkforceError) return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof Error && /não encontrad[oa]|não pertence/.test(error.message)) return Response.json({ error: error.message }, { status: 404 });
  console.error(fallback, error);
  return Response.json({ error: fallback }, { status: 500 });
}

export async function jsonPayload(request: Request) {
  try { return { payload: await request.json() as unknown, response: null }; }
  catch { return { payload: null, response: Response.json({ error: 'Solicitação inválida.' }, { status: 400 }) }; }
}
