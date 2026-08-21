import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { IdempotencyConflictError, createProvisioningModule } from '@/lib/provisioning/module';

type ProvisioningModule = ReturnType<typeof createProvisioningModule>;

type ProvisioningHttpDependencies = {
  provisioning: ProvisioningModule;
  secret: string;
};

const tenantSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();

const userSchema = z.object({
  tenantId: z.uuid(),
  email: z.email().max(254),
  displayName: z.string().trim().min(2).max(160),
  role: z.enum(['manager', 'employee']),
  temporaryPassword: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/),
}).strict();

const resetPasswordSchema = z.object({
  tenantId: z.uuid(),
  temporaryPassword: z.string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/)
    .regex(/[^a-zA-Z0-9]/),
}).strict();

function isAuthorized(request: Request, secret: string) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function idempotencyKey(request: Request) {
  const key = request.headers.get('idempotency-key')?.trim();
  return key && key.length <= 160 ? key : null;
}

async function parseJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return undefined;
  }
}

function errorResponse(error: unknown) {
  if (error instanceof IdempotencyConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  console.error('Falha no provisionamento:', error);
  return Response.json({ error: 'Não foi possível concluir o provisionamento.' }, { status: 500 });
}

export function createProvisioningHttp({ provisioning, secret }: ProvisioningHttpDependencies) {
  function authorize(request: Request) {
    if (secret.length < 32 || !isAuthorized(request, secret)) {
      return Response.json({ error: 'Não autorizado.' }, { status: 401 });
    }
    return null;
  }

  return {
    async createTenant(request: Request) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;
      const key = idempotencyKey(request);
      if (!key) return Response.json({ error: 'Idempotency-Key é obrigatório.' }, { status: 400 });
      const parsed = tenantSchema.safeParse(await parseJson(request));
      if (!parsed.success) return Response.json({ error: 'Dados do tenant inválidos.' }, { status: 422 });

      try {
        const result = await provisioning.createTenant({ ...parsed.data, idempotencyKey: key });
        return Response.json(result, { status: result.replayed ? 200 : 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async createUser(request: Request) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;
      const key = idempotencyKey(request);
      if (!key) return Response.json({ error: 'Idempotency-Key é obrigatório.' }, { status: 400 });
      const parsed = userSchema.safeParse(await parseJson(request));
      if (!parsed.success) return Response.json({ error: 'Dados do usuário inválidos.' }, { status: 422 });

      try {
        const result = await provisioning.createUser({ ...parsed.data, idempotencyKey: key });
        return Response.json(result, { status: result.replayed ? 200 : 201 });
      } catch (error) {
        return errorResponse(error);
      }
    },

    async resetPassword(request: Request, userId: string) {
      const unauthorized = authorize(request);
      if (unauthorized) return unauthorized;
      const key = idempotencyKey(request);
      if (!key) return Response.json({ error: 'Idempotency-Key é obrigatório.' }, { status: 400 });
      const parsedUserId = z.uuid().safeParse(userId);
      const parsed = resetPasswordSchema.safeParse(await parseJson(request));
      if (!parsedUserId.success || !parsed.success) {
        return Response.json({ error: 'Dados da redefinição inválidos.' }, { status: 422 });
      }
      try {
        const result = await provisioning.resetPassword({
          ...parsed.data,
          userId: parsedUserId.data,
          idempotencyKey: key,
        });
        return Response.json(result);
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}
