'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { employeeAccessAvailability, type EmployeeAccessCandidate } from '@/lib/employee-access/policy';
import { portalPath } from '@/lib/routing/base-path';

type PortalAccessEmployee = EmployeeAccessCandidate & {
  id: string;
  fullName: string;
};

const unavailableMessages = {
  created: 'Este Funcionário já possui um Usuário associado.',
  inactive: 'Ative o Funcionário antes de criar o acesso.',
  onboarding_pending: 'Conclua as pendências de onboarding para liberar a criação do acesso.',
  missing_email: 'Cadastre o e-mail pessoal para definir o Usuário.',
} as const;

export function EmployeePortalAccess({ employee }: { employee: PortalAccessEmployee }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');
  const [error, setError] = useState('');
  const [accessProvisioned, setAccessProvisioned] = useState(false);
  const availability = accessProvisioned ? 'created' : employeeAccessAvailability(employee);

  async function createPortalAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setWarning('');
    setError('');
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const temporaryPassword = String(form.get('temporaryPassword') || '');
    const passwordConfirmation = String(form.get('passwordConfirmation') || '');
    if (temporaryPassword !== passwordConfirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!window.confirm(`Criar acesso ao Portal Synova para ${employee.fullName}?`)) return;

    setBusy(true);
    try {
      const response = await fetch(portalPath(`/api/employees/${employee.id}/portal-access`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ temporaryPassword, passwordConfirmation }),
      });
      const body = await response.json() as {
        error?: string;
        accessCreated?: boolean;
        notificationStatus?: 'sent' | 'failed' | 'skipped';
      };
      if (!response.ok) throw new Error(body.error || 'Não foi possível criar o acesso ao portal.');

      setAccessProvisioned(true);
      if (body.notificationStatus === 'failed') {
        setWarning('O acesso foi criado, mas o e-mail interno não foi enviado. Preserve a senha exibida para tratamento manual; ela não poderá ser recuperada depois que você sair desta tela.');
      } else {
        formElement.reset();
        setMessage(body.notificationStatus === 'skipped'
          ? 'O acesso já havia sido criado; nenhum novo e-mail foi enviado.'
          : 'Acesso criado e credenciais enviadas aos responsáveis internos.');
        router.refresh();
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível criar o acesso ao portal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Portal Synova</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Acesso</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${availability === 'created' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-zinc-300/15 bg-white/5 text-zinc-300'}`}>
          {availability === 'created' ? 'Acesso criado' : 'Sem acesso ao portal'}
        </span>
      </div>

      <div aria-live="polite">
        {message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
        {warning && <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm leading-6 text-amber-200" role="status">{warning}</p>}
        {error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
      </div>

      {availability !== 'available' && !warning ? (
        !message && !warning && <p className="mt-4 text-sm leading-6 text-zinc-400">{unavailableMessages[availability]}</p>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={createPortalAccess}>
          <label className="block text-sm font-bold text-zinc-300">Usuário
            <input className="field mt-2 text-zinc-400" readOnly value={employee.personalEmail!} />
          </label>
          <label className="block text-sm font-bold text-zinc-300">Senha temporária
            <input aria-describedby="temporary-password-help" autoComplete="new-password" className="field mt-2" disabled={accessProvisioned} minLength={12} name="temporaryPassword" required type="password" />
          </label>
          <label className="block text-sm font-bold text-zinc-300">Confirmar senha
            <input autoComplete="new-password" className="field mt-2" disabled={accessProvisioned} minLength={12} name="passwordConfirmation" required type="password" />
          </label>
          <p className="text-xs leading-5 text-zinc-500" id="temporary-password-help">Use ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo. A troca será obrigatória no primeiro acesso.</p>
          <button className="pressable synova-gradient w-full rounded-full px-5 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={busy || accessProvisioned} type="submit">
            {busy ? 'Criando acesso…' : accessProvisioned ? 'Acesso criado' : 'Criar acesso ao portal'}
          </button>
        </form>
      )}
    </section>
  );
}
