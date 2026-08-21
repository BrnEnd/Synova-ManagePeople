import { getHiringHttp } from '@/lib/integrations/hiring/server';

export async function POST(request: Request) {
  try {
    return getHiringHttp().createPreRegistration(request);
  } catch (error) {
    console.error('Integração de contratações indisponível:', error);
    return Response.json({ error: 'Integração não configurada.' }, { status: 503 });
  }
}
