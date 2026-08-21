import { z } from 'zod';
import { InvalidEmployeeError } from '@/lib/employees/module';
import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import type { Identity } from '@/lib/identity/module';
import { getCurrentIdentity } from '@/lib/identity/server';

const createEmployeeSchema = z.object({
  fullName: z.string().max(160),
  email: z.string().email().max(320).optional(),
  document: z.string().max(64).optional(),
  userId: z.uuid().optional(),
}).strict();

async function authorizedManager(): Promise<
  { identity: Identity; response: null } | { identity: null; response: Response }
> {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  return access === 'allowed' && identity ? { identity, response: null } : {
    identity: null,
    response: managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access),
  };
}

export async function GET() {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  const employees = await getEmployeesModule().list(identity.tenantId);
  return Response.json({ employees });
}

export async function POST(request: Request) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = createEmployeeSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do funcionário inválidos.' }, { status: 422 });

  try {
    const employee = await getEmployeesModule().create({
      tenantId: identity.tenantId,
      actorUserId: identity.id,
      ...parsed.data,
    });
    return Response.json({ employee }, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidEmployeeError) return Response.json({ error: error.message }, { status: 422 });
    console.error('Falha ao criar funcionário:', error);
    return Response.json({ error: 'Não foi possível criar o funcionário.' }, { status: 500 });
  }
}
