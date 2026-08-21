import { describe, expect, test } from 'vitest';
import { createHiringHttp } from '@/lib/integrations/hiring/http';
import { createHiringIntegrationModule } from '@/lib/integrations/hiring/module';
import { InMemoryHiringRepository } from '@/lib/integrations/hiring/testing';

function subject() {
  let sequence = 0;
  return createHiringHttp({
    authenticate: async (serviceKey) => serviceKey === 'valid-service-key' ? 'tenant-a' : null,
    integration: createHiringIntegrationModule({
      repository: new InMemoryHiringRepository(),
      generateId: () => `generated-${++sequence}`,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      idempotencySecret: 'integration-idempotency-secret',
    }),
  });
}

function request(body: Record<string, unknown>, options?: { key?: string; idempotencyKey?: string }) {
  return new Request('http://localhost/api/external/v1/hirings', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${options?.key ?? 'valid-service-key'}`,
      'content-type': 'application/json',
      'idempotency-key': options?.idempotencyKey ?? 'request-123',
    },
    body: JSON.stringify(body),
  });
}

describe('request externa de contratação', () => {
  test('rejeita chave de serviço inválida', async () => {
    const response = await subject().createPreRegistration(request({
      externalHiringId: 'hiring-123', fullName: 'Ana Souza',
    }, { key: 'invalid' }));
    expect(response.status).toBe(401);
  });

  test('cria, repete e detecta conflito sem duplicar pré-cadastro', async () => {
    const http = subject();
    const payload = { externalHiringId: 'hiring-123', fullName: 'Ana Souza', email: 'ana@example.com' };
    const first = await http.createPreRegistration(request(payload));
    const replay = await http.createPreRegistration(request(payload));
    const conflict = await http.createPreRegistration(request({ ...payload, fullName: 'Outro Nome' }));

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(conflict.status).toBe(409);
    await expect(first.json()).resolves.toMatchObject({
      employee: { tenantId: 'tenant-a', fullName: 'Ana Souza' },
      externalHiringId: 'hiring-123',
      missingFields: expect.arrayContaining([
        'identificationDocument', 'phone', 'corporateEmail', 'address', 'entryDate',
        'professionalTitle', 'identificationDocumentFile', 'contract', 'allocation', 'financialCondition',
      ]),
      replayed: false,
    });
  });
});
