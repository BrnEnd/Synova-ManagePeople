import { getProvisioningHttp } from '@/lib/provisioning/server';

export async function POST(request: Request) {
  try {
    return getProvisioningHttp().createTenant(request);
  } catch (error) {
    console.error('Provisionamento indisponível:', error);
    return Response.json({ error: 'Provisionamento não configurado.' }, { status: 503 });
  }
}
