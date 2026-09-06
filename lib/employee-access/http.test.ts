import { describe, expect, test } from 'vitest';
import { createEmployeeAccessHttp } from '@/lib/employee-access/http';
import type { Identity } from '@/lib/identity/module';
import {
  createEmployeeAccessModule,
  type AccessEmployee,
  type EmployeeAccessAccounts,
  EmployeeAccessConflictError,
} from '@/lib/employee-access/module';

const manager = {
  id: 'manager-a',
  tenantId: 'tenant-a',
  tenantSlug: 'synova',
  email: 'gestao@synova.com',
  displayName: 'Gestão Synova',
  role: 'manager' as const,
  mustChangePassword: false,
};

const employee: AccessEmployee = {
  id: 'employee-a',
  tenantId: 'tenant-a',
  userId: null,
  fullName: 'Ana Souza',
  personalEmail: 'ana@example.com',
  status: 'active',
  onboardingPending: false,
};

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/employees/employee-a/portal-access', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createAccessTestContext(options?: {
  notificationFails?: boolean;
  employee?: AccessEmployee;
  identity?: Identity | null;
  replayed?: boolean;
  accessConflict?: boolean;
}) {
  const candidate = options?.employee ?? employee;
  const sent: Array<{ employeeName: string; username: string; temporaryPassword: string }> = [];
  const createdAccess: Array<Parameters<EmployeeAccessAccounts['createAccess']>[0]> = [];
  const notificationErrors: Array<{ employeeId: string; userId: string; error: unknown }> = [];
  const access = createEmployeeAccessModule({
    accounts: {
      getEmployee: async () => candidate,
      createAccess: async (input) => {
        createdAccess.push(input);
        if (options?.accessConflict) throw new EmployeeAccessConflictError();
        if (candidate.userId && !options?.replayed) {
          throw new EmployeeAccessConflictError('Este funcionário já possui acesso ao portal.');
        }
        return { user: input.user, replayed: options?.replayed ?? false };
      },
    },
    notify: async (input) => {
      sent.push(input);
      if (options?.notificationFails) throw new Error('Resend unavailable');
    },
    onNotificationError: (input) => { notificationErrors.push(input); },
    hashPassword: async () => ({ salt: 'hashed-salt', hash: 'hashed-password' }),
    idempotencySecret: 'test-idempotency-secret',
    generateId: () => 'user-a',
    now: () => new Date('2026-09-05T12:00:00.000Z'),
  });
  return {
    http: createEmployeeAccessHttp({ access, getIdentity: async () => options && 'identity' in options ? options.identity ?? null : manager }),
    sent,
    createdAccess,
    notificationErrors,
  };
}

describe('criação gerencial de acesso ao portal', () => {
  test('cria e associa o Usuário e envia as credenciais internas', async () => {
    const context = createAccessTestContext();
    const temporaryPassword = 'Synova#2026!Inicial';
    const response = await context.http.create(request({
      temporaryPassword,
      passwordConfirmation: temporaryPassword,
    }), employee.id);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      accessCreated: true,
      user: { id: 'user-a', email: 'ana@example.com' },
      notificationStatus: 'sent',
    });
    expect(context.createdAccess).toHaveLength(1);
    expect(context.createdAccess[0]).toMatchObject({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      user: {
        id: 'user-a', email: 'ana@example.com', role: 'employee', status: 'active', mustChangePassword: true,
      },
      credentials: { passwordSalt: 'hashed-salt', passwordHash: 'hashed-password' },
    });
    expect(JSON.stringify(context.createdAccess)).not.toContain(temporaryPassword);
    expect(context.sent).toEqual([{
      employeeName: 'Ana Souza', username: 'ana@example.com', temporaryPassword,
    }]);
  });

  test.each([
    [{ ...employee, status: 'pre_registration' as const }, 'Apenas funcionários ativos podem receber acesso ao portal.'],
    [{ ...employee, status: 'inactive' as const }, 'Apenas funcionários ativos podem receber acesso ao portal.'],
    [{ ...employee, onboardingPending: true }, 'Conclua o onboarding antes de criar o acesso ao portal.'],
    [{ ...employee, personalEmail: null }, 'Cadastre o e-mail pessoal antes de criar o acesso ao portal.'],
    [{ ...employee, userId: 'existing-user' }, 'Este funcionário já possui acesso ao portal.'],
  ])('rejeita Funcionário inelegível sem notificar', async (candidate, message) => {
    const context = createAccessTestContext({ employee: candidate });
    const response = await context.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);

    expect(response.status).toBe(candidate.userId ? 409 : 422);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(context.createdAccess).toHaveLength(candidate.userId ? 1 : 0);
    expect(context.sent).toHaveLength(0);
  });

  test('rejeita acesso sem Gestor autenticado e senhas inválidas', async () => {
    const unauthenticated = createAccessTestContext({ identity: null });
    const unauthorized = await unauthenticated.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);
    expect(unauthorized.status).toBe(401);

    const context = createAccessTestContext();
    const invalidPassword = await context.http.create(request({
      temporaryPassword: 'fraca',
      passwordConfirmation: 'diferente',
    }), employee.id);
    expect(invalidPassword.status).toBe(422);
    expect(context.createdAccess).toHaveLength(0);
  });

  test.each([
    { ...manager, role: 'employee' as const },
    { ...manager, mustChangePassword: true },
  ])('rejeita identidade sem permissão gerencial', async (identity) => {
    const context = createAccessTestContext({ identity });
    const response = await context.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);

    expect(response.status).toBe(403);
    expect(context.createdAccess).toHaveLength(0);
  });

  test('explica separadamente confirmação divergente e senha fora da política', async () => {
    const context = createAccessTestContext();
    const mismatch = await context.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Outra',
    }), employee.id);
    expect(mismatch.status).toBe(422);
    await expect(mismatch.json()).resolves.toEqual({ error: 'As senhas não coincidem.' });

    const weak = await context.http.create(request({
      temporaryPassword: 'senha-fraca',
      passwordConfirmation: 'senha-fraca',
    }), employee.id);
    expect(weak.status).toBe(422);
    await expect(weak.json()).resolves.toEqual({
      error: 'A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo.',
    });
  });

  test('mantém o acesso criado e sinaliza falha da comunicação interna sem devolver a senha', async () => {
    const context = createAccessTestContext({ notificationFails: true });
    const temporaryPassword = 'Synova#2026!Inicial';
    const response = await context.http.create(request({ temporaryPassword, passwordConfirmation: temporaryPassword }), employee.id);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ accessCreated: true, notificationStatus: 'failed' });
    expect(JSON.stringify(body)).not.toContain(temporaryPassword);
    expect(context.createdAccess).toHaveLength(1);
    expect(context.notificationErrors).toEqual([{
      employeeId: 'employee-a', userId: 'user-a', error: expect.any(Error),
    }]);
    expect(JSON.stringify(context.notificationErrors)).not.toContain(temporaryPassword);
  });

  test('retorna conflito quando o e-mail já pertence a outro Usuário', async () => {
    const context = createAccessTestContext({ accessConflict: true });
    const response = await context.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Não foi possível criar o acesso porque o e-mail já está em uso.',
    });
    expect(context.sent).toHaveLength(0);
  });

  test('não envia novamente as credenciais quando a criação idempotente é repetida', async () => {
    const context = createAccessTestContext({ replayed: true });
    const temporaryPassword = 'Synova#2026!Inicial';
    const response = await context.http.create(request({ temporaryPassword, passwordConfirmation: temporaryPassword }), employee.id);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ notificationStatus: 'skipped' });
    expect(context.createdAccess).toHaveLength(1);
    expect(context.sent).toHaveLength(0);
  });
});
