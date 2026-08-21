import { describe, expect, it, vi } from 'vitest';
import { createApprovalsModule, InvalidApprovalError, type ApprovalRepository } from '@/lib/approvals/module';

function setup(now = new Date('2026-09-01T01:30:00Z')) {
  let id = 0;
  const repository: ApprovalRepository = {
    submit: vi.fn(async () => null), listForManager: vi.fn(async () => []), getForManager: vi.fn(async () => null),
    requestAdjustments: vi.fn(async () => null), approve: vi.fn(async () => null), listNotifications: vi.fn(async () => []),
    markNotificationRead: vi.fn(async () => null), listActiveTenantIds: vi.fn(async () => ['tenant-a', 'tenant-b']),
    createMonthCloseReminders: vi.fn(async (tenantId) => tenantId === 'tenant-a' ? 2 : 1),
  };
  return { repository, module: createApprovalsModule({ repository, generateId: () => `id-${++id}`, now: () => now }) };
}

describe('approvals module', () => {
  it('valida o motivo antes de solicitar ajustes', async () => {
    const { module, repository } = setup();
    await expect(module.requestAdjustments({ tenantId: 'tenant-a', managerUserId: 'manager-a', competenceId: 'competence-a', reason: ' x ' })).rejects.toBeInstanceOf(InvalidApprovalError);
    expect(repository.requestAdjustments).not.toHaveBeenCalled();
  });

  it('não revela competências fora do escopo retornado pelo repositório', async () => {
    const { module } = setup();
    await expect(module.submit({ tenantId: 'tenant-b', userId: 'user-a', competenceId: 'competence-a' })).rejects.toThrow('Competência não encontrada.');
    await expect(module.approve({ tenantId: 'tenant-a', managerUserId: 'manager-b', competenceId: 'competence-a' })).rejects.toThrow('Competência não encontrada.');
  });

  it('processa lembretes uma vez por tenant no último dia útil de São Paulo', async () => {
    const { module, repository } = setup();
    await expect(module.runMonthCloseReminders()).resolves.toEqual({ processed: true, localDate: '2026-08-31', notifications: 3 });
    expect(repository.createMonthCloseReminders).toHaveBeenCalledTimes(2);
    expect(repository.createMonthCloseReminders).toHaveBeenCalledWith('tenant-a', '2026-08-01', expect.any(Date), expect.any(Function));
  });

  it('não sensibiliza fora do último dia útil', async () => {
    const { module, repository } = setup(new Date('2026-08-28T12:00:00Z'));
    await expect(module.runMonthCloseReminders()).resolves.toEqual({ processed: false, localDate: '2026-08-28', notifications: 0 });
    expect(repository.listActiveTenantIds).not.toHaveBeenCalled();
  });
});
