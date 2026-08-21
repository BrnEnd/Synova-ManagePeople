import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function POST(_request: Request, context: RouteContext<'/api/employees/[employeeId]/inactivate'>) {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  if (access !== 'allowed') return managerAccessResponse(access);
  if (!identity) return managerAccessResponse('unauthenticated');

  const { employeeId } = await context.params;
  try {
    const employee = await getEmployeesModule().inactivate({
      tenantId: identity.tenantId,
      employeeId,
      actorUserId: identity.id,
    });
    return Response.json({ employee });
  } catch (error) {
    if (error instanceof Error && error.message === 'Funcionário não encontrado.') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Falha ao inativar funcionário:', error);
    return Response.json({ error: 'Não foi possível inativar o funcionário.' }, { status: 500 });
  }
}
