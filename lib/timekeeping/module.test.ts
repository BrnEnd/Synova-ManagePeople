import { describe, expect, it, vi } from 'vitest';
import { createTimekeepingModule, InvalidTimekeepingError, MissingAllocationError, type CompetenceDetail, type TimekeepingRepository } from '@/lib/timekeeping/module';

const baseDetail: CompetenceDetail = {
  competence: { id: 'competence-a', tenantId: 'tenant-a', employeeId: 'employee-a', allocationId: 'allocation-a', clientId: 'client-a', managerUserId: 'manager-a', clientName: 'Cliente A', managerName: 'Gestor A', referenceMonth: '2026-08-01', status: 'filling', totalMinutes: 0, revision: 1, submittedAt: null, approvedAt: null, approvedByUserId: null, approvedMinutes: null, hourlyRateCents: null, approvedAmountCents: null, adjustmentReason: null, createdAt: new Date(), updatedAt: new Date() },
  entries: [],
};

function setup(detail: CompetenceDetail | null = baseDetail) {
  let id = 0;
  const repository: TimekeepingRepository = {
    openCompetence: vi.fn(async () => detail), listCompetencies: vi.fn(async () => detail ? [detail.competence] : []),
    getOwnedCompetence: vi.fn(async (tenantId, userId) => tenantId === 'tenant-a' && userId === 'user-a' ? detail : null),
    saveEntry: vi.fn(async (entry) => detail ? { ...detail, entries: [{ ...entry }], competence: { ...detail.competence, totalMinutes: entry.minutes } } : null),
    deleteEntry: vi.fn(async () => detail),
  };
  return { repository, module: createTimekeepingModule({ repository, generateId: () => `id-${++id}`, now: () => new Date('2026-08-21T12:00:00Z') }) };
}

describe('timekeeping module', () => {
  it('abre uma competência mensal vinculada ao usuário', async () => {
    const { module, repository } = setup();
    await expect(module.open({ tenantId: 'tenant-a', userId: 'user-a', month: '2026-08' })).resolves.toEqual(baseDetail);
    expect(repository.openCompetence).toHaveBeenCalledWith('tenant-a', 'user-a', '2026-08-01', 'id-1', expect.any(Date));
    await expect(module.open({ tenantId: 'tenant-a', userId: 'user-a', month: '08/2026' })).rejects.toBeInstanceOf(InvalidTimekeepingError);
  });

  it('informa quando não existe alocação correspondente', async () => {
    const { module } = setup(null);
    await expect(module.open({ tenantId: 'tenant-a', userId: 'user-a', month: '2026-08' })).rejects.toBeInstanceOf(MissingAllocationError);
  });

  it('salva em minutos e atualiza a linha existente da mesma data', async () => {
    const existing = { id: 'entry-a', tenantId: 'tenant-a', competenceId: 'competence-a', employeeId: 'employee-a', allocationId: 'allocation-a', workDate: '2026-08-10', minutes: 420, observation: null, createdAt: new Date('2026-08-10'), updatedAt: new Date('2026-08-10') };
    const { module, repository } = setup({ ...baseDetail, entries: [existing] });
    await module.saveEntry({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', workDate: '2026-08-10', minutes: 480, observation: '  Entrega ' });
    expect(repository.saveEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'entry-a', minutes: 480, observation: 'Entrega', createdAt: existing.createdAt }), 'user-a');
  });

  it('bloqueia data fora do mês, duração inválida e competência congelada', async () => {
    const { module } = setup();
    await expect(module.saveEntry({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', workDate: '2026-09-01', minutes: 60 })).rejects.toBeInstanceOf(InvalidTimekeepingError);
    await expect(module.saveEntry({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', workDate: '2026-08-01', minutes: 0 })).rejects.toBeInstanceOf(InvalidTimekeepingError);
    const frozen = setup({ ...baseDetail, competence: { ...baseDetail.competence, status: 'awaiting_approval' } });
    await expect(frozen.module.saveEntry({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', workDate: '2026-08-01', minutes: 60 })).rejects.toBeInstanceOf(InvalidTimekeepingError);
  });

  it('não permite consultar competência de outro usuário ou tenant', async () => {
    const { module } = setup();
    await expect(module.get('tenant-b', 'user-a', 'competence-a')).rejects.toThrow('Competência não encontrada.');
    await expect(module.get('tenant-a', 'user-b', 'competence-a')).rejects.toThrow('Competência não encontrada.');
  });
});
