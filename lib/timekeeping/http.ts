import { getCurrentIdentity } from '@/lib/identity/server';
import { InvalidTimekeepingError, MissingAllocationError } from '@/lib/timekeeping/module';

export async function authorizedEmployee() {
  const identity = await getCurrentIdentity();
  if (!identity) return { identity: null, response: Response.json({ error: 'Não autorizado.' }, { status: 401 }) };
  if (identity.mustChangePassword) return { identity: null, response: Response.json({ error: 'Altere sua senha antes de continuar.' }, { status: 403 }) };
  if (identity.role !== 'employee') return { identity: null, response: Response.json({ error: 'Acesso restrito ao funcionário.' }, { status: 403 }) };
  return { identity, response: null };
}
export function timekeepingError(error: unknown, fallback: string) {
  if (error instanceof InvalidTimekeepingError) return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof MissingAllocationError) return Response.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && /não encontrad/.test(error.message)) return Response.json({ error: error.message }, { status: 404 });
  console.error(fallback, error); return Response.json({ error: fallback }, { status: 500 });
}
