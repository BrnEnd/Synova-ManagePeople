import { describe, expect, test } from 'vitest';
import { IdempotencyConflictError, createProvisioningModule } from '@/lib/provisioning/module';
import { InMemoryProvisioningRepository } from '@/lib/provisioning/testing';

describe('provisionamento', () => {
  test('a mesma request de tenant é reproduzida sem criar duplicidade', async () => {
    const provisioning = createProvisioningModule({
      repository: new InMemoryProvisioningRepository(),
      generateId: () => '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      idempotencySecret: 'test-idempotency-secret',
    });

    const first = await provisioning.createTenant({
      name: 'Synova',
      slug: 'synova',
      idempotencyKey: 'bootstrap-synova',
    });
    const replay = await provisioning.createTenant({
      name: 'Synova',
      slug: 'synova',
      idempotencyKey: 'bootstrap-synova',
    });

    expect(first).toEqual({
      tenant: {
        id: '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
        name: 'Synova',
        slug: 'synova',
        status: 'active',
        createdAt: new Date('2026-08-20T12:00:00.000Z'),
      },
      replayed: false,
    });
    expect(replay).toEqual({ ...first, replayed: true });
  });

  test('uma chave já usada com outro conteúdo é rejeitada', async () => {
    const provisioning = createProvisioningModule({
      repository: new InMemoryProvisioningRepository(),
      generateId: () => '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      idempotencySecret: 'test-idempotency-secret',
    });

    await provisioning.createTenant({
      name: 'Synova',
      slug: 'synova',
      idempotencyKey: 'bootstrap-synova',
    });

    await expect(provisioning.createTenant({
      name: 'Outro tenant',
      slug: 'outro',
      idempotencyKey: 'bootstrap-synova',
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  test('cria um gestor no tenant sem expor a senha na resposta', async () => {
    const repository = new InMemoryProvisioningRepository();
    const ids = [
      '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
      '07050f2f-4fef-47f0-b903-a873b7922e08',
    ];
    const provisioning = createProvisioningModule({
      repository,
      generateId: () => ids.shift()!,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      hashPassword: async () => ({ salt: 'salt', hash: 'derived-hash' }),
      idempotencySecret: 'test-idempotency-secret',
    });
    const { tenant } = await provisioning.createTenant({
      name: 'Synova',
      slug: 'synova',
      idempotencyKey: 'bootstrap-synova',
    });

    const result = await provisioning.createUser({
      tenantId: tenant.id,
      email: ' GESTAO@SYNOVA.COM ',
      displayName: 'Gestão Synova',
      role: 'manager',
      temporaryPassword: 'Synova#2026!Inicial',
      idempotencyKey: 'bootstrap-manager',
    });

    expect(result).toEqual({
      user: {
        id: '07050f2f-4fef-47f0-b903-a873b7922e08',
        tenantId: tenant.id,
        email: 'gestao@synova.com',
        displayName: 'Gestão Synova',
        role: 'manager',
        status: 'active',
        mustChangePassword: true,
        createdAt: new Date('2026-08-20T12:00:00.000Z'),
      },
      replayed: false,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('passwordSalt');
  });

  test('redefine a senha temporária e volta a exigir troca no acesso', async () => {
    const repository = new InMemoryProvisioningRepository();
    const ids = [
      '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
      '07050f2f-4fef-47f0-b903-a873b7922e08',
    ];
    const provisioning = createProvisioningModule({
      repository,
      generateId: () => ids.shift()!,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      hashPassword: async (password) => ({ salt: `${password}-salt`, hash: `${password}-hash` }),
      idempotencySecret: 'test-idempotency-secret',
    });
    const { tenant } = await provisioning.createTenant({ name: 'Synova', slug: 'synova', idempotencyKey: 'tenant' });
    const { user: created } = await provisioning.createUser({
      tenantId: tenant.id,
      email: 'gestao@synova.com',
      displayName: 'Gestão Synova',
      role: 'manager',
      temporaryPassword: 'Synova#2026!Inicial',
      idempotencyKey: 'user',
    });

    const result = await provisioning.resetPassword({
      tenantId: tenant.id,
      userId: created.id,
      temporaryPassword: 'Synova#2026!Redefinida',
      idempotencyKey: 'reset-1',
    });

    expect(result).toMatchObject({
      user: { id: created.id, tenantId: tenant.id, mustChangePassword: true },
      replayed: false,
    });
  });

  test('rejeita a mesma chave quando a senha temporária muda', async () => {
    const repository = new InMemoryProvisioningRepository();
    const ids = [
      '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
      '07050f2f-4fef-47f0-b903-a873b7922e08',
      '91e1190c-0fcc-4b60-aadd-bd01cd6dcf13',
    ];
    const provisioning = createProvisioningModule({
      repository,
      generateId: () => ids.shift()!,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
      hashPassword: async (password) => ({ salt: `${password}-salt`, hash: `${password}-hash` }),
      idempotencySecret: 'test-idempotency-secret',
    });
    const { tenant } = await provisioning.createTenant({ name: 'Synova', slug: 'synova', idempotencyKey: 'tenant' });

    await provisioning.createUser({
      tenantId: tenant.id,
      email: 'gestao@synova.com',
      displayName: 'Gestão Synova',
      role: 'manager',
      temporaryPassword: 'Synova#2026!Inicial',
      idempotencyKey: 'user',
    });

    await expect(provisioning.createUser({
      tenantId: tenant.id,
      email: 'gestao@synova.com',
      displayName: 'Gestão Synova',
      role: 'manager',
      temporaryPassword: 'Outra#2026!Senha',
      idempotencyKey: 'user',
    })).rejects.toBeInstanceOf(IdempotencyConflictError);
  });
});
