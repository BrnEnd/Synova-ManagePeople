import { z } from 'zod';
import { InvalidEmployeeError } from '@/lib/employees/module';
import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const noteSchema = z.object({ content: z.string().trim().min(2).max(4000) }).strict();

export async function POST(request: Request, context: RouteContext<'/api/employees/[employeeId]/notes'>) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed' || !identity) {
    return managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access);
  }
  const { employeeId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = noteSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Anotação inválida.' }, { status: 422 });
  try {
    const note = await getEmployeesModule().addNote({
      tenantId: identity.tenantId,
      employeeId,
      actorUserId: identity.id,
      content: parsed.data.content,
    });
    return Response.json({ note }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidEmployeeError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Error && error.message === 'Funcionário não encontrado.') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Falha ao criar anotação:', error);
    return Response.json({ error: 'Não foi possível registrar a anotação.' }, { status: 500 });
  }
}
