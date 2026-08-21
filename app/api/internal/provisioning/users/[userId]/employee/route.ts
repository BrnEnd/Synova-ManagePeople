import { getProvisioningHttp } from '@/lib/provisioning/server';

export async function POST(
  request: Request,
  context: RouteContext<'/api/internal/provisioning/users/[userId]/employee'>,
) {
  try {
    const { userId } = await context.params;
    return getProvisioningHttp().associateUser(request, userId);
  } catch (error) {
    console.error('Provisionamento indisponível:', error);
    return Response.json({ error: 'Provisionamento não configurado.' }, { status: 503 });
  }
}
