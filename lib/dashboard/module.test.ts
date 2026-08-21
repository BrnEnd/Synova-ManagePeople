import { describe, expect, it, vi } from 'vitest';
import { createDashboardModule, saoPauloMonth, type DashboardRepository } from '@/lib/dashboard/module';

describe('dashboard module', () => {
  it('calcula a competência corrente no fuso de São Paulo', () => {
    expect(saoPauloMonth(new Date('2026-09-01T01:00:00Z'))).toMatchObject({ referenceMonth: '2026-08-01', monthEnd: '2026-08-31' });
  });

  it('consulta a fotografia mensal do gestor', async () => {
    const snapshot = { activeEmployees: 2, newHires: 1, newHiresPending: 1, notSubmitted: 1, awaitingApproval: 1, awaitingInvoice: 0, awaitingPayment: 0, paymentForecastCents: 100_000, revenueForecastCents: 150_000 };
    const repository: DashboardRepository = { load: vi.fn(async () => snapshot) };
    const dashboard = createDashboardModule({ repository, now: () => new Date('2026-08-21T12:00:00Z') });
    await expect(dashboard.load('tenant-a', 'manager-a')).resolves.toEqual(snapshot);
    expect(repository.load).toHaveBeenCalledWith('tenant-a', 'manager-a', expect.objectContaining({ referenceMonth: '2026-08-01' }));
  });
});
