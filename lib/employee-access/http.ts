import { z } from 'zod';
import type { Identity } from '@/lib/identity/module';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { strongPasswordMessage, strongPasswordSchema } from '@/lib/identity/password-policy';
import {
  EmployeeAccessConflictError,
  EmployeeAccessIneligibleError,
  EmployeeAccessNotFoundError,
  createEmployeeAccessModule,
} from '@/lib/employee-access/module';

type EmployeeAccessModule = ReturnType<typeof createEmployeeAccessModule>;

const accessSchema = z.object({
  temporaryPassword: z.string(),
  passwordConfirmation: z.string(),
}).strict();

export function createEmployeeAccessHttp(dependencies: {
  access: EmployeeAccessModule;
  getIdentity: () => Promise<Identity | null>;
}) {
  return {
    async create(request: Request, employeeId: string) {
      const identity = await dependencies.getIdentity();
      const authorization = managerAccess(identity);
      if (authorization !== 'allowed') return managerAccessResponse(authorization);
      if (!identity) return managerAccessResponse('unauthenticated');

      let payload: unknown;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });
      }
      const parsed = accessSchema.safeParse(payload);
      if (!parsed.success) {
        return Response.json({ error: 'Informe a senha temporária e a confirmação.' }, { status: 422 });
      }
      if (parsed.data.temporaryPassword !== parsed.data.passwordConfirmation) {
        return Response.json({ error: 'As senhas não coincidem.' }, { status: 422 });
      }
      if (!strongPasswordSchema.safeParse(parsed.data.temporaryPassword).success) {
        return Response.json({ error: strongPasswordMessage }, { status: 422 });
      }

      try {
        const result = await dependencies.access.create({
          tenantId: identity.tenantId,
          employeeId,
          actorUserId: identity.id,
          temporaryPassword: parsed.data.temporaryPassword,
        });
        return Response.json(result, { status: result.notificationStatus === 'skipped' ? 200 : 201 });
      } catch (error) {
        if (error instanceof EmployeeAccessNotFoundError) {
          return Response.json({ error: error.message }, { status: 404 });
        }
        if (error instanceof EmployeeAccessIneligibleError) {
          return Response.json({ error: error.message }, { status: 422 });
        }
        if (error instanceof EmployeeAccessConflictError) {
          return Response.json({ error: error.message }, { status: 409 });
        }
        console.error('Falha ao criar acesso do funcionário:', error);
        return Response.json({ error: 'Não foi possível criar o acesso ao portal.' }, { status: 500 });
      }
    },
  };
}
