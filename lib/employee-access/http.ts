import { z } from 'zod';
import type { Identity } from '@/lib/identity/module';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { strongPasswordSchema } from '@/lib/identity/password-policy';
import {
  EmployeeAccessConflictError,
  EmployeeAccessIneligibleError,
  EmployeeAccessNotFoundError,
  createEmployeeAccessModule,
} from '@/lib/employee-access/module';

type EmployeeAccessModule = ReturnType<typeof createEmployeeAccessModule>;

const accessSchema = z.object({
  temporaryPassword: strongPasswordSchema,
  passwordConfirmation: z.string(),
}).strict().refine(
  (value) => value.temporaryPassword === value.passwordConfirmation,
  { message: 'As senhas não coincidem.', path: ['passwordConfirmation'] },
);

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
        return Response.json({ error: 'Informe uma senha temporária válida e confirme-a corretamente.' }, { status: 422 });
      }

      try {
        const result = await dependencies.access.create({
          tenantId: identity.tenantId,
          employeeId,
          actorUserId: identity.id,
          temporaryPassword: parsed.data.temporaryPassword,
        });
        return Response.json(result, { status: 201 });
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
