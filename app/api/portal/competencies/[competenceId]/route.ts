import { authorizedEmployee, timekeepingError } from '@/lib/timekeeping/http';
import { getTimekeepingModule } from '@/lib/timekeeping/server';
export async function GET(_request: Request, context: { params: Promise<{ competenceId: string }> }) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  try { const { competenceId } = await context.params; return Response.json(await getTimekeepingModule().get(identity.tenantId, identity.id, competenceId)); }
  catch (error) { return timekeepingError(error, 'Não foi possível consultar a competência.'); }
}
