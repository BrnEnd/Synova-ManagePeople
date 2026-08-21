import { InvalidApprovalError } from '@/lib/approvals/module';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function authorizedManager() {
  const identity = await getCurrentIdentity(); const access = managerAccess(identity);
  return access === 'allowed' && identity ? { identity, response: null } : { identity: null, response: managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access) };
}
export async function authorizedAnyUser() {
  const identity = await getCurrentIdentity();
  if (!identity) return { identity: null, response: Response.json({ error: 'Não autorizado.' }, { status: 401 }) };
  if (identity.mustChangePassword) return { identity: null, response: Response.json({ error: 'Altere sua senha antes de continuar.' }, { status: 403 }) };
  return { identity, response: null };
}
export function approvalError(error: unknown, fallback: string) {
  if (error instanceof InvalidApprovalError) return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof Error && /não encontrad/.test(error.message)) return Response.json({ error: error.message }, { status: 404 });
  console.error(fallback, error); return Response.json({ error: fallback }, { status: 500 });
}
