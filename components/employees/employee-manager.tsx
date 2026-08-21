'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

export type EmployeeListItem = {
  id: string;
  fullName: string;
  email: string | null;
  document: string | null;
  status: 'pre_registration' | 'active' | 'inactive';
  onboardingPending: boolean;
  userId: string | null;
  createdAt: string;
};

const statusLabel: Record<EmployeeListItem['status'], string> = {
  pre_registration: 'Pré-cadastro',
  active: 'Ativo',
  inactive: 'Inativo',
};

const statusClass: Record<EmployeeListItem['status'], string> = {
  pre_registration: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  active: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  inactive: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
};

export function EmployeeManager({ employees }: { employees: EmployeeListItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [inactivating, setInactivating] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      fullName: String(formData.get('fullName') || ''),
      email: String(formData.get('email') || '') || undefined,
      document: String(formData.get('document') || '') || undefined,
    };

    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível criar o funcionário.');
      form.reset();
      setMessage('Pré-cadastro criado. As pendências de onboarding já estão sinalizadas.');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar o funcionário.');
    } finally {
      setBusy(false);
    }
  }

  async function inactivate(employee: EmployeeListItem) {
    if (!window.confirm(`Inativar ${employee.fullName}? O histórico será preservado.`)) return;
    setInactivating(employee.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/employees/${employee.id}/inactivate`, { method: 'POST' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível inativar o funcionário.');
      setMessage(`${employee.fullName} foi inativado sem apagar o histórico.`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível inativar o funcionário.');
    } finally {
      setInactivating(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="employee-list-title" className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/65">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Equipe</p>
            <h2 className="mt-2 text-xl font-black text-white" id="employee-list-title">{employees.length} funcionário{employees.length === 1 ? '' : 's'}</h2>
          </div>
          <p className="text-sm text-zinc-500">Histórico preservado após inativação</p>
        </div>

        {employees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-400/10 text-xl text-orange-300" aria-hidden="true">+</div>
            <h3 className="mt-4 font-black text-white">Nenhum funcionário cadastrado</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">Crie o primeiro pré-cadastro. Informações ausentes continuarão visíveis como pendências de onboarding.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/8">
            {employees.map((employee) => (
              <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={employee.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-black text-white">{employee.fullName}</p>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass[employee.status]}`}>{statusLabel[employee.status]}</span>
                    {employee.onboardingPending && employee.status !== 'inactive' && (
                      <span className="rounded-full border border-orange-300/20 bg-orange-300/10 px-2.5 py-1 text-xs font-bold text-orange-200">Documentação pendente</span>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm text-zinc-400">{employee.email || 'E-mail ainda não informado'}</p>
                  <p className="mt-1 text-xs text-zinc-600">{employee.userId ? 'Acesso associado' : 'Sem acesso ao portal'} · Criado em {new Intl.DateTimeFormat('pt-BR').format(new Date(employee.createdAt))}</p>
                </div>
                <button
                  className="pressable w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={employee.status === 'inactive' || inactivating === employee.id}
                  onClick={() => inactivate(employee)}
                  type="button"
                >
                  {inactivating === employee.id ? 'Inativando…' : employee.status === 'inactive' ? 'Inativo' : 'Inativar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6 xl:sticky xl:top-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Novo cadastro</p>
        <h2 className="mt-2 text-xl font-black text-white">Adicionar funcionário</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">Comece com os dados disponíveis. O cadastro nasce com onboarding pendente.</p>
        <form className="mt-6 space-y-4" onSubmit={createEmployee}>
          <label className="block text-sm font-bold text-zinc-300">
            Nome completo
            <input className="field mt-2" name="fullName" minLength={2} maxLength={160} required autoComplete="name" />
          </label>
          <label className="block text-sm font-bold text-zinc-300">
            E-mail <span className="font-normal text-zinc-600">(opcional)</span>
            <input className="field mt-2" name="email" type="email" maxLength={320} autoComplete="email" />
          </label>
          <label className="block text-sm font-bold text-zinc-300">
            Documento <span className="font-normal text-zinc-600">(opcional)</span>
            <input className="field mt-2" name="document" maxLength={64} />
          </label>
          <button className="pressable synova-gradient w-full rounded-full px-5 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={busy} type="submit">
            {busy ? 'Criando…' : 'Criar pré-cadastro'}
          </button>
        </form>
        <div aria-live="polite" className="mt-4">
          {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
        </div>
      </aside>
    </div>
  );
}
