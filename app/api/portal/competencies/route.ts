import { authorizedEmployee, timekeepingError } from '@/lib/timekeeping/http';
import { getTimekeepingModule } from '@/lib/timekeeping/server';
import { monthSchema } from '@/lib/timekeeping/validation';

export async function GET() {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  return Response.json({ competencies: await getTimekeepingModule().list(identity.tenantId, identity.id) });
}
export async function POST(request: Request) {
  const { identity, response } = await authorizedEmployee(); if (!identity) return response;
  let payload: unknown; try { payload = await request.json(); } catch { return Response.json({ error: 'Solicitação inválida.' }, { status: 400 }); }
  const parsed = monthSchema.safeParse((payload as { month?: unknown } | null)?.month);
  if (!parsed.success) return Response.json({ error: 'Competência inválida.' }, { status: 422 });
  try { return Response.json(await getTimekeepingModule().open({ tenantId: identity.tenantId, userId: identity.id, month: parsed.data }), { status: 201 }); }
  catch (error) { return timekeepingError(error, 'Não foi possível abrir a competência.'); }
}
