import { describe, expect, test } from 'vitest';
import { HiringConflictError, createHiringIntegrationModule } from '@/lib/integrations/hiring/module';
import { InMemoryHiringRepository } from '@/lib/integrations/hiring/testing';

function subject() {
  let sequence = 0;
  return createHiringIntegrationModule({
    repository: new InMemoryHiringRepository(),
    generateId: () => `generated-${++sequence}`,
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    idempotencySecret: 'integration-idempotency-secret',
  });
}

describe('integração de contratações', () => {
  test('cria pré-cadastro com pendências e repete a mesma contratação sem duplicar', async () => {
    const integration = subject();
    const command = {
      tenantId: 'tenant-a',
      externalHiringId: 'hiring-123',
      idempotencyKey: 'request-123',
      fullName: '  Ana Souza  ',
      email: ' ANA@EXAMPLE.COM ',
    };

    const first = await integration.createPreRegistration(command);
    const replay = await integration.createPreRegistration(command);

    expect(first).toMatchObject({
      employee: {
        tenantId: 'tenant-a',
        fullName: 'Ana Souza',
        email: 'ana@example.com',
        status: 'pre_registration',
        onboardingPending: true,
      },
      missingFields: ['document', 'contract', 'allocation', 'financialCondition'],
      replayed: false,
    });
    expect(replay).toEqual({ ...first, replayed: true });
  });

  test('rejeita externalHiringId repetido com conteúdo diferente', async () => {
    const integration = subject();
    await integration.createPreRegistration({
      tenantId: 'tenant-a', externalHiringId: 'hiring-123', idempotencyKey: 'request-123', fullName: 'Ana Souza',
    });

    await expect(integration.createPreRegistration({
      tenantId: 'tenant-a', externalHiringId: 'hiring-123', idempotencyKey: 'request-456', fullName: 'Outro Nome',
    })).rejects.toBeInstanceOf(HiringConflictError);
  });

  test('isola o mesmo identificador externo entre tenants', async () => {
    const integration = subject();
    const first = await integration.createPreRegistration({
      tenantId: 'tenant-a', externalHiringId: 'hiring-123', idempotencyKey: 'request-123', fullName: 'Ana Souza',
    });
    const second = await integration.createPreRegistration({
      tenantId: 'tenant-b', externalHiringId: 'hiring-123', idempotencyKey: 'request-123', fullName: 'Bia Lima',
    });

    expect(first.employee.id).not.toBe(second.employee.id);
  });
});
