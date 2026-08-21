import { z } from 'zod';
import { InvalidEmployeeError } from '@/lib/employees/module';
import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const associationSchema = z.object({ userId: z.uuid() }).strict();

export async function POST(
  request: Request,
  context: RouteContext<'/api/employees/[employeeId]/user'>,
) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed') return managerAccessResponse(access);
  if (!identity) return managerAccessResponse('unauthenticated');

  const { employeeId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = associationSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados da associação inválidos.' }, { status: 422 });

  try {
    const employee = await getEmployeesModule().associateUser({
      tenantId: identity.tenantId,
      employeeId,
      userId: parsed.data.userId,
      actorUserId: identity.id,
    });
    return Response.json({ employee });
  } catch (error) {
    if (error instanceof InvalidEmployeeError) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message === 'Funcionário não encontrado.') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Falha ao associar usuário ao funcionário:', error);
    return Response.json({ error: 'Não foi possível associar o usuário.' }, { status: 500 });
  }
}
