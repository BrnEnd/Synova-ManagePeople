// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeePortalAccess } from '@/components/employees/employee-portal-access';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const employee = {
  id: 'employee-a', fullName: 'Bruna Soares', personalEmail: 'bruna@example.com', userId: null,
  status: 'active' as const, onboardingPending: false,
  documentationMode: 'legacy' as const, documentationStatus: 'legacy',
};

describe('EmployeePortalAccess', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accessCreated: true, notificationStatus: 'sent' }), {
      status: 201, headers: { 'content-type': 'application/json' },
    })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('preenche e envia a senha temporária padrão sem digitação', async () => {
    const user = userEvent.setup();
    const defaultTemporaryPassword = 'Synova#2026!Inicial';
    render(<EmployeePortalAccess employee={employee} defaultTemporaryPassword={defaultTemporaryPassword} />);

    expect(screen.getByLabelText('Senha temporária')).toHaveProperty('value', defaultTemporaryPassword);
    expect(screen.getByLabelText('Senha temporária')).toHaveProperty('readOnly', true);
    expect(screen.getByLabelText('Confirmar senha')).toHaveProperty('value', defaultTemporaryPassword);
    expect(screen.getByLabelText('Confirmar senha')).toHaveProperty('readOnly', true);

    await user.click(screen.getByRole('button', { name: 'Criar acesso ao portal' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/portal/api/employees/employee-a/portal-access', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ temporaryPassword: defaultTemporaryPassword, passwordConfirmation: defaultTemporaryPassword }),
    })));
  });

  it('lista todas as pendências operacionais antes de permitir o acesso', () => {
    render(<EmployeePortalAccess employee={{
      ...employee,
      operationalReadiness: {
        hasActiveContract: false,
        hasActiveAllocation: false,
        hasFinancialCondition: false,
        hasCommercialCondition: false,
      },
    }} defaultTemporaryPassword="Synova#2026!Inicial" />);

    expect(screen.getByText('Cadastre um Contrato ativo para o funcionário.')).not.toBeNull();
    expect(screen.getByText('Cadastre uma Alocação ativa para o funcionário.')).not.toBeNull();
    expect(screen.getByText('Cadastre a condição financeira vigente.')).not.toBeNull();
    expect(screen.getByText('Cadastre a condição comercial vigente na Alocação.')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Criar acesso ao portal' })).toBeNull();
  });
});
