import { authorizedEmployee, timekeepingError } from '@/lib/timekeeping/http';
import { getTimekeepingModule } from '@/lib/timekeeping/server';
import { timeEntrySchema } from '@/lib/timekeeping/validation';
export async function POST(request: Request, context: { params: Promise<{ competenceId: string }> }) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  let payload: unknown; try { payload = await request.json(); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const parsed = timeEntrySchema.safeParse(payload); if (!parsed.success) return Response.json({ error: 'Lançamento inválido.' }, { status: 422 });
  try { const { competenceId } = await context.params; return Response.json(await getTimekeepingModule().saveEntry({ tenantId: identity.tenantId, userId: identity.id, competenceId, ...parsed.data })); }
  catch (error) { return timekeepingError(error, 'Não foi possível salvar o lançamento.'); }
}
