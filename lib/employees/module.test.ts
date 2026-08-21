import { describe, expect, test } from 'vitest';
import { createEmployeesModule, InvalidEmployeeError } from '@/lib/employees/module';
import { InMemoryEmployeeRepository } from '@/lib/employees/testing';

const tenantA = 'tenant-a';
const tenantB = 'tenant-b';
const actor = 'manager-1';

function subject(repository = new InMemoryEmployeeRepository()) {
  let sequence = 0;
  return {
    repository,
    module: createEmployeesModule({
      repository,
      generateId: () => `employee-${++sequence}`,
      now: () => new Date('2026-08-20T12:00:00.000Z'),
    }),
  };
}

describe('funcionários', () => {
  test('cria pré-cadastro normalizado e auditável', async () => {
    const { module, repository } = subject();
    const employee = await module.create({
      tenantId: tenantA, actorUserId: actor, fullName: '  Ana Souza  ', email: ' ANA@EXAMPLE.COM ', document: ' 123 ',
    });

    expect(employee).toMatchObject({
      tenantId: tenantA, fullName: 'Ana Souza', personalEmail: 'ana@example.com',
      identificationDocument: '123', status: 'pre_registration', onboardingPending: true,
    });
    expect(employee.missingFields).toContain('identificationDocumentFile');
    expect(repository.events).toEqual([{ eventType: 'employee.created', employeeId: employee.id }]);
  });

  test('não lista nem inativa funcionário de outro tenant', async () => {
    const { module } = subject();
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });
    await module.create({ tenantId: tenantB, actorUserId: actor, fullName: 'Bia Lima' });

    await expect(module.list(tenantA)).resolves.toHaveLength(1);
    await expect(module.inactivate({ tenantId: tenantB, employeeId: employee.id, actorUserId: actor }))
      .rejects.toThrow('Funcionário não encontrado.');
  });

  test('inativa sem apagar o histórico', async () => {
    const { module, repository } = subject();
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });
    const inactivated = await module.inactivate({ tenantId: tenantA, employeeId: employee.id, actorUserId: actor });

    expect(inactivated).toMatchObject({ status: 'inactive', inactivatedAt: new Date('2026-08-20T12:00:00.000Z') });
    await expect(module.list(tenantA)).resolves.toHaveLength(1);
    expect(repository.events.at(-1)).toEqual({ eventType: 'employee.inactivated', employeeId: employee.id });
    await expect(module.inactivate({ tenantId: tenantA, employeeId: employee.id, actorUserId: actor }))
      .rejects.toThrow('Funcionário não encontrado.');
  });

  test('exige nome válido', async () => {
    const { module } = subject();
    await expect(module.create({ tenantId: tenantA, actorUserId: actor, fullName: ' ' }))
      .rejects.toBeInstanceOf(InvalidEmployeeError);
  });

  test('rejeita associação com usuário que não pertence ao tenant do funcionário', async () => {
    const { module, repository } = subject();
    repository.addLinkableUser(tenantB, 'employee-user');

    await expect(module.create({
      tenantId: tenantA,
      actorUserId: actor,
      fullName: 'Ana Souza',
      userId: 'employee-user',
    })).rejects.toBeInstanceOf(InvalidEmployeeError);
  });

  test('associa um usuário funcionário do mesmo tenant e audita a mudança', async () => {
    const { module, repository } = subject();
    repository.addLinkableUser(tenantA, 'employee-user');
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });

    const associated = await module.associateUser({
      tenantId: tenantA,
      employeeId: employee.id,
      userId: 'employee-user',
      actorUserId: actor,
    });

    expect(associated.userId).toBe('employee-user');
    expect(repository.events.at(-1)).toEqual({
      eventType: 'employee.user_associated',
      employeeId: employee.id,
    });
  });

  test('completa o perfil, preserva PJ e permite ativação após receber identificação', async () => {
    const { module, repository } = subject();
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });
    repository.addIdentificationDocument(tenantA, employee.id);

    const updated = await module.update({
      tenantId: tenantA,
      employeeId: employee.id,
      actorUserId: actor,
      status: 'active',
      profile: {
        fullName: ' Ana Souza ',
        personalEmail: 'ANA@EXAMPLE.COM',
        corporateEmail: 'ANA@SYNOVA.COM.BR',
        phone: '+55 11 99999-9999',
        identificationDocument: '123.456.789-00',
        address: {
          street: 'Rua Um', city: 'São Paulo', state: 'sp', postalCode: '01000-000', country: 'Brasil',
        },
        entryDate: '2026-08-01',
        professionalTitle: 'Engenheira de Software',
        employmentType: 'PJ',
      },
    });

    expect(updated).toMatchObject({
      status: 'active', onboardingPending: false, missingFields: [], employmentType: 'pj',
      personalEmail: 'ana@example.com', corporateEmail: 'ana@synova.com.br',
      address: { state: 'SP' },
    });
    expect(repository.events.at(-1)).toEqual({ eventType: 'employee.updated', employeeId: employee.id });
  });

  test('não ativa funcionário enquanto houver pendências de onboarding', async () => {
    const { module } = subject();
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });

    await expect(module.update({
      tenantId: tenantA,
      employeeId: employee.id,
      actorUserId: actor,
      status: 'active',
      profile: {
        fullName: employee.fullName,
        personalEmail: null,
        corporateEmail: null,
        phone: null,
        identificationDocument: null,
        address: null,
        entryDate: null,
        professionalTitle: null,
        employmentType: 'pj',
      },
    })).rejects.toThrow('Conclua as pendências');
  });

  test('registra anotação com autor e não permite escrever em outro tenant', async () => {
    const { module, repository } = subject();
    const employee = await module.create({ tenantId: tenantA, actorUserId: actor, fullName: 'Ana Souza' });

    await expect(module.addNote({
      tenantId: tenantA, employeeId: employee.id, actorUserId: actor, content: ' Acompanhamento iniciado. ',
    })).resolves.toMatchObject({ content: 'Acompanhamento iniciado.', authorName: 'Gestor de teste' });
    await expect(module.addNote({
      tenantId: tenantB, employeeId: employee.id, actorUserId: actor, content: 'Tentativa cruzada',
    })).rejects.toThrow('Funcionário não encontrado.');
    expect(repository.events.filter((event) => event.eventType === 'employee.note_added')).toHaveLength(1);
  });
});
