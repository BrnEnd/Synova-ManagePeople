import { describe, expect, test } from 'vitest';
import { createProvisioningHttp } from '@/lib/provisioning/http';
import { createProvisioningModule } from '@/lib/provisioning/module';
import { InMemoryProvisioningRepository } from '@/lib/provisioning/testing';

function createTestHttp() {
  return createTestContext().http;
}

function createTestContext() {
  const ids = [
    '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
    '07050f2f-4fef-47f0-b903-a873b7922e08',
  ];
  const repository = new InMemoryProvisioningRepository();
  const provisioning = createProvisioningModule({
    repository,
    generateId: () => ids.shift()!,
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    hashPassword: async () => ({ salt: 'salt', hash: 'hash' }),
    idempotencySecret: 'test-idempotency-secret',
  });
  return { http: createProvisioningHttp({ provisioning, secret: 'a'.repeat(32) }), repository };
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

  test('associa usuário e funcionário por request autenticada e idempotente', async () => {
    const { http, repository } = createTestContext();
    const headers = {
      authorization: `Bearer ${'a'.repeat(32)}`,
      'content-type': 'application/json',
      'idempotency-key': 'tenant',
    };
    const tenantResponse = await http.createTenant(new Request('http://localhost/api/internal/provisioning/tenants', {
      method: 'POST', headers, body: JSON.stringify({ name: 'Synova', slug: 'synova' }),
    }));
    const { tenant } = await tenantResponse.json() as { tenant: { id: string } };
    const userResponse = await http.createUser(new Request('http://localhost/api/internal/provisioning/users', {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'employee-user' },
      body: JSON.stringify({
        tenantId: tenant.id,
        email: 'ana@synova.com',
        displayName: 'Ana Souza',
        role: 'employee',
        temporaryPassword: 'Synova#2026!Inicial',
      }),
    }));
    const { user } = await userResponse.json() as { user: { id: string } };
    const employeeId = '8bef33d1-84c9-4233-b888-15e35d5a9193';
    repository.addEmployee(tenant.id, employeeId);
    const associationRequest = () => new Request(`http://localhost/api/internal/provisioning/users/${user.id}/employee`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'association' },
      body: JSON.stringify({ tenantId: tenant.id, employeeId }),
    });

    const first = await http.associateUser(associationRequest(), user.id);
    const replay = await http.associateUser(associationRequest(), user.id);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      association: { tenantId: tenant.id, userId: user.id, employeeId },
      replayed: false,
    });
    await expect(replay.json()).resolves.toMatchObject({ replayed: true });
  });

  test('cadastra chave de serviço por request sem devolvê-la', async () => {
    const http = createTestHttp();
    const rawServiceKey = 'service-key-with-more-than-32-characters';
    const response = await http.createServiceKey(new Request('http://localhost/api/internal/provisioning/service-keys', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'a'.repeat(32)}`,
        'content-type': 'application/json',
        'idempotency-key': 'portal-vagas-key',
      },
      body: JSON.stringify({
        tenantId: '8bef33d1-84c9-4233-b888-15e35d5a9193',
        name: 'Portal de Vagas',
        serviceKey: rawServiceKey,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      serviceKey: { tenantId: '8bef33d1-84c9-4233-b888-15e35d5a9193', name: 'Portal de Vagas' },
      replayed: false,
    });
    expect(JSON.stringify(body)).not.toContain(rawServiceKey);
  });
});
