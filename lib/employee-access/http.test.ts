import { describe, expect, test } from 'vitest';
import { createEmployeeAccessHttp } from '@/lib/employee-access/http';
import { createEmployeeAccessModule, type AccessEmployee } from '@/lib/employee-access/module';

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

function subject(options?: { notificationFails?: boolean; employee?: AccessEmployee; identity?: typeof manager | null; replayed?: boolean }) {
  const sent: Array<{ employeeName: string; username: string; temporaryPassword: string }> = [];
  const associated: Array<{ employeeId: string; userId: string; actorUserId: string }> = [];
  const notificationErrors: Array<{ employeeId: string; userId: string; error: unknown }> = [];
  const access = createEmployeeAccessModule({
    accounts: {
      getEmployee: async () => options?.employee ?? employee,
      createUser: async (input) => ({
        id: 'user-a',
        tenantId: input.tenantId,
        email: input.email,
        displayName: input.displayName,
        role: 'employee',
        mustChangePassword: true,
        replayed: options?.replayed ?? false,
      }),
      associateUser: async (input) => { associated.push(input); },
    },
    notify: async (input) => {
      sent.push(input);
      if (options?.notificationFails) throw new Error('Resend unavailable');
    },
    onNotificationError: (input) => { notificationErrors.push(input); },
  });
  return {
    http: createEmployeeAccessHttp({ access, getIdentity: async () => options && 'identity' in options ? options.identity ?? null : manager }),
    sent,
    associated,
    notificationErrors,
  };
}

describe('criação gerencial de acesso ao portal', () => {
  test('cria e associa o Usuário e envia as credenciais internas', async () => {
    const context = subject();
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
    expect(context.associated).toEqual([{
      tenantId: 'tenant-a', employeeId: 'employee-a', userId: 'user-a', actorUserId: 'manager-a',
    }]);
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
  ])('rejeita Funcionário inelegível sem criar ou notificar', async (candidate, message) => {
    const context = subject({ employee: candidate });
    const response = await context.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);

    expect(response.status).toBe(candidate.userId ? 409 : 422);
    await expect(response.json()).resolves.toEqual({ error: message });
    expect(context.associated).toHaveLength(0);
    expect(context.sent).toHaveLength(0);
  });

  test('rejeita acesso sem Gestor autenticado e senhas inválidas', async () => {
    const unauthenticated = subject({ identity: null });
    const unauthorized = await unauthenticated.http.create(request({
      temporaryPassword: 'Synova#2026!Inicial',
      passwordConfirmation: 'Synova#2026!Inicial',
    }), employee.id);
    expect(unauthorized.status).toBe(401);

    const context = subject();
    const invalidPassword = await context.http.create(request({
      temporaryPassword: 'fraca',
      passwordConfirmation: 'diferente',
    }), employee.id);
    expect(invalidPassword.status).toBe(422);
    expect(context.associated).toHaveLength(0);
  });

  test('mantém o acesso criado e sinaliza falha da comunicação interna sem devolver a senha', async () => {
    const context = subject({ notificationFails: true });
    const temporaryPassword = 'Synova#2026!Inicial';
    const response = await context.http.create(request({ temporaryPassword, passwordConfirmation: temporaryPassword }), employee.id);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ accessCreated: true, notificationStatus: 'failed' });
    expect(JSON.stringify(body)).not.toContain(temporaryPassword);
    expect(context.associated).toHaveLength(1);
    expect(context.notificationErrors).toEqual([{
      employeeId: 'employee-a', userId: 'user-a', error: expect.any(Error),
    }]);
    expect(JSON.stringify(context.notificationErrors)).not.toContain(temporaryPassword);
  });

  test('não envia novamente as credenciais quando a criação idempotente é repetida', async () => {
    const context = subject({ replayed: true });
    const temporaryPassword = 'Synova#2026!Inicial';
    const response = await context.http.create(request({ temporaryPassword, passwordConfirmation: temporaryPassword }), employee.id);

    expect(response.status).toBe(201);
    expect(context.associated).toHaveLength(1);
    expect(context.sent).toHaveLength(0);
  });
});
