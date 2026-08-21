import { authorizedEmployee, timekeepingError } from '@/lib/timekeeping/http';
import { getTimekeepingModule } from '@/lib/timekeeping/server';
export async function DELETE(_request: Request, context: { params: Promise<{ competenceId: string; entryId: string }> }) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  try { const { competenceId, entryId } = await context.params; return Response.json(await getTimekeepingModule().deleteEntry({ tenantId: identity.tenantId, userId: identity.id, competenceId, entryId })); }
  catch (error) { return timekeepingError(error, 'Não foi possível excluir o lançamento.'); }
}
