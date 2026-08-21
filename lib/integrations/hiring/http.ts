import { z } from 'zod';
import { HiringConflictError, createHiringIntegrationModule } from '@/lib/integrations/hiring/module';

type HiringModule = ReturnType<typeof createHiringIntegrationModule>;

const hiringSchema = z.object({
  externalHiringId: z.string().trim().min(1).max(160),
  fullName: z.string().trim().min(2).max(160),
  email: z.email().max(320).optional(),
  document: z.string().trim().min(1).max(64).optional(),
}).strict();

function bearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  return authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : null;
}

export function createHiringHttp(dependencies: {
  integration: HiringModule;
  authenticate: (serviceKey: string) => Promise<string | null>;
}) {
  return {
    async createPreRegistration(request: Request) {
      const serviceKey = bearerToken(request);
      if (!serviceKey) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
      const tenantId = await dependencies.authenticate(serviceKey);
      if (!tenantId) return Response.json({ error: 'Não autorizado.' }, { status: 401 });
      const idempotencyKey = request.headers.get('idempotency-key')?.trim();
      if (!idempotencyKey || idempotencyKey.length > 160) {
        return Response.json({ error: 'Idempotency-Key é obrigatório.' }, { status: 400 });
      }
      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
      }
      const parsed = hiringSchema.safeParse(payload);
      if (!parsed.success) return Response.json({ error: 'Dados da contratação inválidos.' }, { status: 422 });
      try {
        const result = await dependencies.integration.createPreRegistration({
          ...parsed.data,
          tenantId,
          idempotencyKey,
        });
        return Response.json(result, { status: result.replayed ? 200 : 201 });
      } catch (error) {
        if (error instanceof HiringConflictError) {
          return Response.json({ error: error.message }, { status: 409 });
        }
        console.error('Falha no pré-cadastro externo:', error);
        return Response.json({ error: 'Não foi possível criar o pré-cadastro.' }, { status: 500 });
      }
    },
  };
}
