import { describe, expect, test } from 'vitest';
import { createClientsModule, InvalidClientError } from '@/lib/clients/module';
import { InMemoryClientRepository } from '@/lib/clients/testing';

function subject() {
  const repository = new InMemoryClientRepository();
  const clientsModule = createClientsModule({
    repository, generateId: () => 'client-1', now: () => new Date('2026-08-21T12:00:00.000Z'),
  });
  return { clientsModule, repository };
}

const profile = {
  name: ' Synova Cliente ', legalName: ' Synova Cliente Ltda ', taxId: '12.345.678/0001-90',
  contactName: ' Ana ', email: ' CONTATO@CLIENTE.COM ', phone: '11999999999', address: null,
  observations: ' Cliente estratégico ',
};

describe('clientes', () => {
  test('cria cliente normalizado e auditável', async () => {
    const { clientsModule, repository } = subject();
    await expect(clientsModule.create({ tenantId: 'tenant-a', actorUserId: 'manager-a', profile })).resolves.toMatchObject({
      name: 'Synova Cliente', legalName: 'Synova Cliente Ltda', taxId: '12345678000190',
      email: 'contato@cliente.com', status: 'active',
    });
    expect(repository.events).toEqual(['client.created']);
  });

  test('isola consulta, edição e inativação entre tenants', async () => {
    const { clientsModule } = subject();
    const client = await clientsModule.create({ tenantId: 'tenant-a', actorUserId: 'manager-a', profile });
    await expect(clientsModule.list('tenant-b')).resolves.toEqual([]);
    await expect(clientsModule.update({ tenantId: 'tenant-b', clientId: client.id, actorUserId: 'manager-b', profile }))
      .rejects.toThrow('Cliente não encontrado.');
    await expect(clientsModule.inactivate({ tenantId: 'tenant-b', clientId: client.id, actorUserId: 'manager-b' }))
      .rejects.toThrow('Cliente não encontrado.');
  });

  test('inativa sem apagar e não gera evento repetido', async () => {
    const { clientsModule, repository } = subject();
    const client = await clientsModule.create({ tenantId: 'tenant-a', actorUserId: 'manager-a', profile });
    await expect(clientsModule.inactivate({ tenantId: 'tenant-a', clientId: client.id, actorUserId: 'manager-a' }))
      .resolves.toMatchObject({ status: 'inactive' });
    await expect(clientsModule.list('tenant-a')).resolves.toHaveLength(1);
    await expect(clientsModule.inactivate({ tenantId: 'tenant-a', clientId: client.id, actorUserId: 'manager-a' }))
      .rejects.toThrow('Cliente não encontrado.');
    expect(repository.events).toEqual(['client.created', 'client.inactivated']);
  });

  test('rejeita nome e CNPJ inválidos', async () => {
    const { clientsModule } = subject();
    await expect(clientsModule.create({ tenantId: 'tenant-a', actorUserId: 'manager-a', profile: { ...profile, name: ' ' } }))
      .rejects.toBeInstanceOf(InvalidClientError);
    await expect(clientsModule.create({ tenantId: 'tenant-a', actorUserId: 'manager-a', profile: { ...profile, taxId: '123' } }))
      .rejects.toThrow('14 dígitos');
  });
});
