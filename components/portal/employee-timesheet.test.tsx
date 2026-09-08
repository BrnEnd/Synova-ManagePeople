// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeeTimesheet } from '@/components/portal/employee-timesheet';
import type { CompetenceStatus } from '@/lib/timekeeping/module';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@vercel/blob/client', () => ({ upload: vi.fn() }));

const competence = {
  id: 'competence-a', tenantId: 'tenant-a', employeeId: 'employee-a', referenceMonth: '2026-08-01',
  clientName: 'Cliente A', managerName: 'Gestora A', status: 'filling' as const, totalMinutes: 450,
  adjustmentReason: null, forecastDocumentId: null, invoiceDocumentId: null,
};

const mondayEntry = { id: 'entry-a', workDate: '2026-08-03', minutes: 450, observation: 'Planejamento' };

function renderTimesheet(overrides: { status?: CompetenceStatus; entries?: typeof mondayEntry[] } = {}) {
  const entries = overrides.entries ?? [mondayEntry];
  render(<EmployeeTimesheet
    blobEnabled={false}
    detail={{ competence: { ...competence, status: overrides.status ?? competence.status }, entries }}
    history={[]}
    notifications={[]}
    payment={null}
  />);
}

describe('apontamento mensal do Funcionário', () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('permite preencher dias consecutivos no calendário e persiste a duração em minutos', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      competence: { ...competence, totalMinutes: 930 },
      entries: [mondayEntry, { id: 'entry-b', workDate: '2026-08-04', minutes: 480, observation: null }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    renderTimesheet();

    expect(screen.getByRole('columnheader', { name: 'Seg' })).toBeTruthy();
    expect((screen.getByLabelText('Horas de segunda-feira, 3 de agosto de 2026') as HTMLInputElement).value).toBe('07:30');

    const tuesday = screen.getByLabelText('Horas de terça-feira, 4 de agosto de 2026');
    await user.type(tuesday, '8');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/portal/api/portal/competencies/competence-a/entries',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ workDate: '2026-08-04', minutes: 480, observation: null }),
      }),
    ));
    await waitFor(() => expect((tuesday as HTMLInputElement).value).toBe('08:00'));
    expect(document.activeElement).toBe(screen.getByLabelText('Horas de quarta-feira, 5 de agosto de 2026'));
    expect(screen.getByText('15h 30min')).toBeTruthy();
  });

  it('salva a observação do dia selecionado sem alterar sua duração', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      competence,
      entries: [{ ...mondayEntry, observation: 'Revisão da sprint' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    renderTimesheet();

    const observation = screen.getByRole('textbox', { name: 'Observação' });
    await user.clear(observation);
    await user.type(observation, 'Revisão da sprint');
    await user.click(screen.getByRole('button', { name: 'Salvar observação' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/portal/api/portal/competencies/competence-a/entries',
      expect.objectContaining({
        body: JSON.stringify({ workDate: '2026-08-03', minutes: 450, observation: 'Revisão da sprint' }),
      }),
    ));
  });

  it('descarta o estado pendente quando o Funcionário restaura o valor já salvo', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    renderTimesheet();

    const monday = screen.getByLabelText('Horas de segunda-feira, 3 de agosto de 2026');
    await user.clear(monday);
    await user.type(monday, '8');
    await user.clear(monday);
    await user.type(monday, '07:30');
    await user.tab();

    await waitFor(() => expect(screen.queryByText('Conclua ou corrija as alterações do calendário antes de enviar.')).toBeNull());
    expect((screen.getByRole('button', { name: 'Enviar horas para aprovação' }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mantém um valor com falha disponível para correção e bloqueia o envio', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Serviço indisponível.' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    }));
    renderTimesheet();

    const tuesday = screen.getByLabelText('Horas de terça-feira, 4 de agosto de 2026');
    await user.type(tuesday, '6:30');
    await user.keyboard('{Enter}');

    expect((await screen.findByRole('alert')).textContent).toContain('Serviço indisponível.');
    expect((tuesday as HTMLInputElement).value).toBe('6:30');
    expect((screen.getByRole('button', { name: 'Enviar horas para aprovação' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('exclui explicitamente o lançamento selecionado e reconcilia o total', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      competence: { ...competence, totalMinutes: 0 },
      entries: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    renderTimesheet();

    await user.click(screen.getByRole('button', { name: 'Excluir lançamento' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/portal/api/portal/competencies/competence-a/entries/entry-a',
      { method: 'DELETE' },
    ));
    await waitFor(() => expect(screen.getByText('0h')).toBeTruthy());
    expect(screen.queryByRole('button', { name: 'Excluir lançamento' })).toBeNull();
  });

  it('apresenta a Competência congelada no mesmo calendário em modo de leitura', () => {
    renderTimesheet({ status: 'awaiting_approval' });

    expect(screen.getByRole('grid', { name: 'Calendário mensal de apontamentos' })).toBeTruthy();
    expect(screen.getByLabelText('Horas de segunda-feira, 3 de agosto de 2026: 07:30').textContent).toBe('07:30');
    expect(screen.queryByRole('button', { name: 'Salvar observação' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enviar horas para aprovação' })).toBeNull();
  });

  it('mantém Tab e Shift+Tab na sequência cronológica dos campos de horas', async () => {
    const user = userEvent.setup();
    renderTimesheet();
    const monday = screen.getByLabelText('Horas de segunda-feira, 3 de agosto de 2026');
    const tuesday = screen.getByLabelText('Horas de terça-feira, 4 de agosto de 2026');

    monday.focus();
    await user.tab();
    expect(document.activeElement).toBe(tuesday);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(monday);
  });

  it('protege a célula contra nova edição enquanto o valor está sendo salvo', async () => {
    const user = userEvent.setup();
    let finishRequest!: (response: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise((resolve) => { finishRequest = resolve; }));
    renderTimesheet();
    const tuesday = screen.getByLabelText('Horas de terça-feira, 4 de agosto de 2026') as HTMLInputElement;

    await user.type(tuesday, '8');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(tuesday.disabled).toBe(true));
    expect(tuesday.getAttribute('aria-describedby')).toBe('status-2026-08-04');
    expect(document.getElementById('status-2026-08-04')?.textContent).toContain('Salvando');

    finishRequest(new Response(JSON.stringify({
      competence: { ...competence, totalMinutes: 930 },
      entries: [mondayEntry, { id: 'entry-b', workDate: '2026-08-04', minutes: 480, observation: null }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await waitFor(() => expect(tuesday.disabled).toBe(false));
  });

  it('abre pelo teclado a observação correspondente ao dia em foco', async () => {
    const user = userEvent.setup();
    renderTimesheet();
    const tuesday = screen.getByLabelText('Horas de terça-feira, 4 de agosto de 2026');

    tuesday.focus();
    await user.keyboard('{F2}');

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Observação' })));
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('terça-feira, 4 de agosto de 2026');
  });
});
