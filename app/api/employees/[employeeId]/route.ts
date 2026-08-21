import { z } from 'zod';
import { InvalidEmployeeError } from '@/lib/employees/module';
import { getEmployeesModule } from '@/lib/employees/server';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getCurrentIdentity } from '@/lib/identity/server';

const optionalText = (maximum: number) => z.string().trim().max(maximum).nullable();
const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  personalEmail: z.union([z.email().max(320), z.literal(''), z.null()]).transform((value) => value || null),
  corporateEmail: z.union([z.email().max(320), z.literal(''), z.null()]).transform((value) => value || null),
  phone: optionalText(32),
  identificationDocument: optionalText(64),
  address: z.object({
    street: z.string().trim().max(160),
    number: z.string().trim().max(32).optional(),
    complement: z.string().trim().max(120).optional(),
    district: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120),
    state: z.string().trim().max(32),
    postalCode: z.string().trim().max(24),
    country: z.string().trim().max(80),
  }).nullable(),
  entryDate: z.union([z.iso.date(), z.literal(''), z.null()]).transform((value) => value || null),
  professionalTitle: optionalText(160),
  employmentType: z.string().trim().min(2).max(40),
  status: z.enum(['pre_registration', 'active']),
}).strict();

async function authorizedManager() {
  const identity = await getCurrentIdentity();
  const access = managerAccess(identity);
  return access === 'allowed' && identity ? { identity, response: null } : {
    identity: null,
    response: managerAccessResponse(access === 'allowed' ? 'unauthenticated' : access),
  };
}

export async function GET(_request: Request, context: RouteContext<'/api/employees/[employeeId]'>) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  const { employeeId } = await context.params;
  const detail = await getEmployeesModule().detail(identity.tenantId, employeeId);
  return detail ? Response.json(detail) : Response.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext<'/api/employees/[employeeId]'>) {
  const { identity, response } = await authorizedManager();
  if (!identity) return response;
  const { employeeId } = await context.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados do funcionário inválidos.' }, { status: 422 });
  try {
    const { status, ...profile } = parsed.data;
    const employee = await getEmployeesModule().update({
      tenantId: identity.tenantId,
      employeeId,
      actorUserId: identity.id,
      profile,
      status,
    });
    return Response.json({ employee });
  } catch (error) {
    if (error instanceof InvalidEmployeeError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof Error && error.message === 'Funcionário não encontrado.') {
      return Response.json({ error: error.message }, { status: 404 });
    }
    console.error('Falha ao atualizar funcionário:', error);
    return Response.json({ error: 'Não foi possível atualizar o funcionário.' }, { status: 500 });
  }
}
