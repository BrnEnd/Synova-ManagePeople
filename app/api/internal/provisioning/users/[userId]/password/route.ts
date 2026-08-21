import { getProvisioningHttp } from '@/lib/provisioning/server';

export async function POST(request: Request, context: RouteContext<'/api/internal/provisioning/users/[userId]/password'>) {
  try {
    const { userId } = await context.params;
    return getProvisioningHttp().resetPassword(request, userId);
  } catch (error) {
    console.error('Provisionamento indisponível:', error);
    return Response.json({ error: 'Provisionamento não configurado.' }, { status: 503 });
  }
}
