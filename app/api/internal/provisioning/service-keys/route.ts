import { getProvisioningHttp } from '@/lib/provisioning/server';

export async function POST(request: Request) {
  try {
    return getProvisioningHttp().createServiceKey(request);
  } catch (error) {
    console.error('Provisionamento indisponível:', error);
    return Response.json({ error: 'Provisionamento não configurado.' }, { status: 503 });
  }
}
