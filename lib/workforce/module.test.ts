import { describe, expect, it, vi } from 'vitest';
import { createWorkforceModule, InvalidWorkforceError, type WorkforceRepository } from '@/lib/workforce/module';

function setup(overrides: Partial<WorkforceRepository> = {}) {
  let id = 0;
  const repository: WorkforceRepository = {
    employeeExists: vi.fn(async (tenantId, employeeId) => tenantId === 'tenant-a' && employeeId === 'employee-a'),
    documentBelongsToEmployee: vi.fn(async (tenantId, documentId, employeeId) => tenantId === 'tenant-a' && documentId === 'document-a' && employeeId === 'employee-a'),
    allocationExists: vi.fn(async (tenantId, allocationId) => tenantId === 'tenant-a' && allocationId === 'allocation-a'),
    createContract: vi.fn(async (contract) => contract), listContracts: vi.fn(async () => []),
    endContract: vi.fn(async () => null), createAllocation: vi.fn(async (allocation) => ({ ...allocation, clientName: 'Cliente', managerName: 'Gestor' })),
    listAllocations: vi.fn(async () => []), endAllocation: vi.fn(async () => null), listFinancialConditions: vi.fn(async () => []),
    addFinancialCondition: vi.fn(async (condition) => condition), listCommercialConditions: vi.fn(async () => []),
    addCommercialCondition: vi.fn(async (condition) => condition), listOptions: vi.fn(async () => ({ clients: [], managers: [] })),
    ...overrides,
  };
  return {
    repository,
    module: createWorkforceModule({ repository, generateId: () => `id-${++id}`, now: () => new Date('2026-08-21T12:00:00Z') }),
  };
}

describe('workforce module', () => {
  it('cria contrato vinculado somente a documento do mesmo funcionário e tenant', async () => {
    const { module, repository } = setup();
    const contract = await module.createContract({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', documentId: 'document-a',
      contractType: '  Prestação de serviços ', startDate: '2026-08-01', observations: '  Inicial ',
    });
    expect(contract).toMatchObject({ contractType: 'Prestação de serviços', documentId: 'document-a', observations: 'Inicial', status: 'active' });
    expect(repository.createContract).toHaveBeenCalledOnce();
    await expect(module.createContract({ tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', documentId: 'document-x', contractType: 'PJ', startDate: '2026-08-01' })).rejects.toBeInstanceOf(InvalidWorkforceError);
  });

  it('rejeita períodos invertidos e referências fora do tenant', async () => {
    const { module } = setup();
    await expect(module.createContract({ tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', contractType: 'PJ', startDate: '2026-09-01', endDate: '2026-08-31' })).rejects.toBeInstanceOf(InvalidWorkforceError);
    await expect(module.createAllocation({ tenantId: 'tenant-b', employeeId: 'employee-a', actorUserId: 'manager-b', clientId: 'client-a', managerUserId: 'manager-b', startDate: '2026-08-01' })).rejects.toThrow('Funcionário não encontrado.');
  });

  it('versiona a condição financeira fechando a vigência anterior no dia precedente', async () => {
    const previous = { id: 'condition-1', tenantId: 'tenant-a', employeeId: 'employee-a', hourlyRateCents: 10_000, effectiveFrom: '2026-01-01', effectiveTo: null, observations: null, createdByUserId: 'manager-a', createdAt: new Date() };
    const add = vi.fn(async (condition) => condition);
    const { module } = setup({ listFinancialConditions: vi.fn(async () => [previous]), addFinancialCondition: add });
    await module.addFinancialCondition({ tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', hourlyRateCents: 12_500, effectiveFrom: '2026-09-01' });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ hourlyRateCents: 12_500 }), 'condition-1', '2026-08-31', 'manager-a');
    await expect(module.addFinancialCondition({ tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', hourlyRateCents: 12_500, effectiveFrom: '2026-01-01' })).rejects.toBeInstanceOf(InvalidWorkforceError);
  });

  it('mantém custo financeiro e preço comercial em históricos separados', async () => {
    const addCommercial = vi.fn(async (condition) => condition);
    const { module, repository } = setup({ addCommercialCondition: addCommercial });
    await module.addFinancialCondition({ tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a', hourlyRateCents: 9_000, effectiveFrom: '2026-08-01' });
    await module.addCommercialCondition({ tenantId: 'tenant-a', allocationId: 'allocation-a', actorUserId: 'manager-a', hourlyRateCents: 18_000, effectiveFrom: '2026-08-01' });
    expect(repository.addFinancialCondition).toHaveBeenCalledWith(expect.objectContaining({ hourlyRateCents: 9_000 }), null, null, 'manager-a');
    expect(addCommercial).toHaveBeenCalledWith(expect.objectContaining({ hourlyRateCents: 18_000 }), null, null, 'manager-a');
  });
});
