import { describe, expect, test } from 'vitest';
import { createIdentityModule } from '@/lib/identity/module';
import { InMemoryIdentityRepository } from '@/lib/identity/testing';

const user = {
  id: '07050f2f-4fef-47f0-b903-a873b7922e08',
  tenantId: '2cd093b3-4d03-4b2b-80a5-f8ec8d7e0eb7',
  tenantSlug: 'synova',
  email: 'gestao@synova.com',
  displayName: 'Gestão Synova',
  role: 'manager' as const,
  mustChangePassword: true,
  passwordSalt: 'salt',
  passwordHash: 'hash',
};

describe('identidade', () => {
  test('autentica no tenant correto e retorna somente a identidade segura', async () => {
    const identity = createIdentityModule({
      repository: new InMemoryIdentityRepository([user]),
      verifyPassword: async (password) => password === 'Synova#2026!Inicial',
      now: () => new Date('2026-08-20T12:00:00.000Z'),
    });

    const result = await identity.authenticate({
      tenantSlug: ' SYNOVA ',
      email: ' GESTAO@SYNOVA.COM ',
      password: 'Synova#2026!Inicial',
      ip: '127.0.0.1',
    });

    expect(result).toEqual({
      identity: {
        id: user.id,
        tenantId: user.tenantId,
        tenantSlug: 'synova',
        email: 'gestao@synova.com',
        displayName: 'Gestão Synova',
        role: 'manager',
        mustChangePassword: true,
      },
      rateLimited: false,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  test('não autentica o mesmo e-mail em outro tenant', async () => {
    const identity = createIdentityModule({
      repository: new InMemoryIdentityRepository([user]),
      verifyPassword: async () => true,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
    });

    const result = await identity.authenticate({
      tenantSlug: 'outro-tenant',
      email: 'gestao@synova.com',
      password: 'Synova#2026!Inicial',
      ip: '127.0.0.1',
    });

    expect(result).toEqual({ identity: null, rateLimited: false });
  });

  test('uma sessão não resolve identidade em outro tenant', async () => {
    const identity = createIdentityModule({
      repository: new InMemoryIdentityRepository([user]),
      verifyPassword: async () => true,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
    });

    await expect(identity.resolveSession({ userId: user.id, tenantId: user.tenantId })).resolves.toMatchObject({
      id: user.id,
      tenantId: user.tenantId,
      role: 'manager',
    });
    await expect(identity.resolveSession({
      userId: user.id,
      tenantId: 'e5a288fd-ae7b-48f3-991f-c30692e02254',
    })).resolves.toBeNull();
  });

  test('troca a senha temporária e libera o primeiro acesso', async () => {
    const repository = new InMemoryIdentityRepository([user]);
    const identity = createIdentityModule({
      repository,
      verifyPassword: async (password) => password === 'Synova#2026!Inicial',
      hashPassword: async () => ({ salt: 'new-salt', hash: 'new-hash' }),
      now: () => new Date('2026-08-20T12:00:00.000Z'),
    });

    const result = await identity.changePassword({
      identity: {
        id: user.id,
        tenantId: user.tenantId,
        tenantSlug: user.tenantSlug,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        mustChangePassword: true,
      },
      currentPassword: 'Synova#2026!Inicial',
      newPassword: 'NovaSenha#2026!Segura',
    });

    expect(result.mustChangePassword).toBe(false);
    await expect(repository.findLoginUser(user.tenantSlug, user.email)).resolves.toMatchObject({
      passwordSalt: 'new-salt',
      passwordHash: 'new-hash',
      mustChangePassword: false,
    });
  });
});
