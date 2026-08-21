import { describe, expect, test } from 'vitest';
import { createProvisioningHttp } from '@/lib/provisioning/http';
import { createProvisioningModule } from '@/lib/provisioning/module';
import { InMemoryProvisioningRepository } from '@/lib/provisioning/testing';

function createTestHttp() {
  const ids = [
    '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
    '07050f2f-4fef-47f0-b903-a873b7922e08',
  ];
  const provisioning = createProvisioningModule({
    repository: new InMemoryProvisioningRepository(),
    generateId: () => ids.shift()!,
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    hashPassword: async () => ({ salt: 'salt', hash: 'hash' }),
    idempotencySecret: 'test-idempotency-secret',
  });
  return createProvisioningHttp({ provisioning, secret: 'a'.repeat(32) });
}

describe('requests de provisionamento', () => {
  test('rejeita request sem segredo de provisionamento', async () => {
    const http = createTestHttp();
    const response = await http.createTenant(new Request('http://localhost/api/internal/provisioning/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'bootstrap-synova' },
      body: JSON.stringify({ name: 'Synova', slug: 'synova' }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Não autorizado.' });
  });

  test('cria tenant e gestor por requests autenticadas', async () => {
    const http = createTestHttp();
    const headers = {
      authorization: `Bearer ${'a'.repeat(32)}`,
      'content-type': 'application/json',
      'idempotency-key': 'bootstrap-synova',
    };
    const tenantResponse = await http.createTenant(new Request('http://localhost/api/internal/provisioning/tenants', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Synova', slug: 'synova' }),
    }));
    const tenantBody = await tenantResponse.json() as { tenant: { id: string } };
    const userResponse = await http.createUser(new Request('http://localhost/api/internal/provisioning/users', {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'bootstrap-manager' },
      body: JSON.stringify({
        tenantId: tenantBody.tenant.id,
        email: 'gestao@synova.com',
        displayName: 'Gestão Synova',
        role: 'manager',
        temporaryPassword: 'Synova#2026!Inicial',
      }),
    }));
    const userBody = await userResponse.clone().json() as { user: { id: string } };
    const resetResponse = await http.resetPassword(new Request(`http://localhost/api/internal/provisioning/users/${userBody.user.id}/password`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'reset-manager-password' },
      body: JSON.stringify({
        tenantId: tenantBody.tenant.id,
        temporaryPassword: 'Synova#2026!Redefinida',
      }),
    }), userBody.user.id);

    expect(tenantResponse.status).toBe(201);
    expect(userResponse.status).toBe(201);
    expect(resetResponse.status).toBe(200);
    await expect(userResponse.json()).resolves.toMatchObject({
      user: { email: 'gestao@synova.com', role: 'manager', mustChangePassword: true },
      replayed: false,
    });
  });
});
