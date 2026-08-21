import { z } from 'zod';
import {
  createBrowserSession,
  deleteBrowserSession,
  getIdentityModule,
  requestIp,
} from '@/lib/identity/server';

const loginSchema = z.object({
  tenantSlug: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z.string().min(1).max(128),
}).strict();

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
  }
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: 'Dados de acesso inválidos.' }, { status: 422 });

  const result = await getIdentityModule().authenticate({ ...parsed.data, ip: requestIp(request) });
  if (result.rateLimited) return Response.json({ error: 'Muitas tentativas. Tente novamente em alguns minutos.' }, { status: 429 });
  if (!result.identity) return Response.json({ error: 'Organização, e-mail ou senha inválidos.' }, { status: 401 });

  await createBrowserSession(result.identity);
  return Response.json({
    identity: {
      displayName: result.identity.displayName,
      role: result.identity.role,
      mustChangePassword: result.identity.mustChangePassword,
    },
  });
}

export async function DELETE() {
  await deleteBrowserSession();
  return new Response(null, { status: 204 });
}
