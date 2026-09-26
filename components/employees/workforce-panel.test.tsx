// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkforcePanel } from '@/components/employees/workforce-panel';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const data = {
  contracts: [],
  allocations: [],
  financialConditions: [],
  current: null,
  history: [],
  options: { clients: [{ id: 'client-a', name: 'Cliente A' }], managers: [{ id: 'manager-a', name: 'Gestora A' }] },
};

describe('WorkforcePanel', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ allocation: { id: 'allocation-a' } }), { status: 201, headers: { 'content-type': 'application/json' } })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('inicia uma alocação com os valores pago e comercial no mesmo formulário', async () => {
    const user = userEvent.setup();
    render(<WorkforcePanel employeeId="employee-a" data={data} contractDocuments={[]} />);

    const allocation = screen.getByRole('heading', { name: 'Nova alocação' }).closest('article')!;
    const form = within(allocation);
    expect(allocation).toBeTruthy();
    expect(form.getByLabelText('Valor/hora pago (R$)')).toHaveProperty('required', true);
    expect(form.getByLabelText('Valor/hora recebido (R$)')).toHaveProperty('required', true);
    expect(screen.queryByRole('heading', { name: 'Nova condição financeira' })).toBeNull();

    await user.selectOptions(form.getByLabelText('Cliente'), 'client-a');
    await user.selectOptions(form.getByLabelText('Gestor responsável'), 'manager-a');
    await user.type(form.getByLabelText('Função'), 'Consultora');
    fireEvent.change(form.getByLabelText('Início'), { target: { value: '2026-08-01' } });
    await user.type(form.getByLabelText('Valor/hora pago (R$)'), '100');
    await user.type(form.getByLabelText('Valor/hora recebido (R$)'), '200');
    await user.click(form.getByRole('button', { name: 'Registrar alocação' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/portal/api/employees/employee-a/allocations', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-a', managerUserId: 'manager-a', roleTitle: 'Consultora', startDate: '2026-08-01', endDate: null,
        financialRateCents: 10_000, commercialRateCents: 20_000, observations: null,
      }),
    })));
  });

  it('completa a condição comercial ausente sem criar uma nova etapa', async () => {
    const user = userEvent.setup();
    render(<WorkforcePanel employeeId="employee-a" data={{
      ...data,
      allocations: [{
        id: 'allocation-a', clientName: 'Cliente A', managerName: 'Gestora A', roleTitle: 'Consultora',
        startDate: '2026-09-28', endDate: '2027-09-30', status: 'active', observations: null, commercialConditions: [],
      }],
      current: {
        allocationId: 'allocation-a', clientName: 'Cliente A', managerName: 'Gestora A', startDate: '2026-09-28', endDate: '2027-09-30',
        contractType: 'PJ', financialRateCents: 7_500, commercialRateCents: null, approvedMinutes: 0, totalPaidCents: 0, totalReceivedCents: null,
      },
    }} contractDocuments={[]} />);

    const completion = screen.getByRole('heading', { name: 'Completar condição comercial' }).closest('div')!;
    const form = within(completion);
    expect(form.getByLabelText('Início da vigência')).toHaveProperty('value', '2026-09-28');
    expect(form.getByLabelText('Início da vigência')).toHaveProperty('readOnly', true);

    await user.type(form.getByLabelText('Valor/hora recebido (R$)'), '83.79');
    await user.click(form.getByRole('button', { name: 'Registrar condição comercial atual' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/portal/api/allocations/allocation-a/commercial-conditions', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ hourlyRateCents: 8_379, effectiveFrom: '2026-09-28', observations: null }),
    })));
  });
});
