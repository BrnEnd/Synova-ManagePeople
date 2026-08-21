import { getApprovalsModule } from '@/lib/approvals/server';
import { approvalError } from '@/lib/approvals/http';
import { authorizedEmployee } from '@/lib/timekeeping/http';
export async function POST(_request: Request, context: { params: Promise<{ competenceId: string }> }) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  try { const { competenceId } = await context.params; return Response.json(await getApprovalsModule().submit({ tenantId: identity.tenantId, userId: identity.id, competenceId })); }
  catch (error) { return approvalError(error, 'Não foi possível enviar a competência.'); }
}
