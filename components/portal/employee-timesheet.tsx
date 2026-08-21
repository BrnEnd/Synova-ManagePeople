'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

type Entry = { id: string; workDate: string; minutes: number; observation: string | null };
type CompetenceData = {
  competence: { id: string; referenceMonth: string; clientName: string; managerName: string; status: string; totalMinutes: number };
  entries: Entry[];
};

const statusLabels: Record<string, string> = {
  filling: 'Em preenchimento', awaiting_approval: 'Aguardando aprovação', adjustments_requested: 'Ajustes solicitados',
  awaiting_invoice: 'Aguardando Nota Fiscal', awaiting_payment: 'Aguardando pagamento', paid: 'Pagamento realizado',
};
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`;
const decimalHours = (minutes: number) => (minutes / 60).toFixed(2).replace(/\.00$/, '');
const monthLabel = (reference: string) => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${reference}T00:00:00Z`));

export function EmployeeTimesheet({ detail, history }: { detail: CompetenceData; history: Array<{ id: string; referenceMonth: string; totalMinutes: number; status: string }> }) {
  const { competence, entries } = detail;
  const router = useRouter();
  const editable = competence.status === 'filling' || competence.status === 'adjustments_requested';
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});

  async function save(event: FormEvent<HTMLFormElement>, key: string) {
    event.preventDefault(); setBusy(key); setFeedback({});
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const minutes = Math.round(Number(form.get('hours')) * 60);
    try {
      const response = await fetch(`/api/portal/competencies/${competence.id}/entries`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workDate: String(form.get('workDate')), minutes, observation: String(form.get('observation') || '').trim() || null }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível salvar.');
      if (key === 'new') formElement.reset(); setFeedback({ success: 'Lançamento salvo e total recalculado.' }); router.refresh();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'Não foi possível salvar.' }); }
    finally { setBusy(''); }
  }

  async function remove(entryId: string) {
    setBusy(`delete-${entryId}`); setFeedback({});
    try {
      const response = await fetch(`/api/portal/competencies/${competence.id}/entries/${entryId}`, { method: 'DELETE' });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível excluir.');
      setFeedback({ success: 'Lançamento removido e total recalculado.' }); router.refresh();
    } catch (error) { setFeedback({ error: error instanceof Error ? error.message : 'Não foi possível excluir.' }); }
    finally { setBusy(''); }
  }

  return <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Competência atual</p><h1 className="mt-2 text-3xl font-black capitalize tracking-[-0.04em] text-white md:text-4xl">{monthLabel(competence.referenceMonth)}</h1><p className="mt-2 text-zinc-400">{competence.clientName} · Gestor: {competence.managerName}</p></div>
      <div className="grid grid-cols-2 gap-3"><Metric label="Total lançado" value={hours(competence.totalMinutes)} /><Metric label="Situação" value={statusLabels[competence.status] || competence.status} /></div>
    </div>

    <div aria-live="polite" className="mt-5">{feedback.success && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{feedback.success}</p>}{feedback.error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{feedback.error}</p>}</div>

    <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
      <div className="border-b border-white/10 px-5 py-5 sm:px-7"><h2 className="text-xl font-black text-white">Apontamento de horas</h2><p className="mt-1 text-sm text-zinc-500">Uma linha por dia. Salvar a mesma data atualiza o lançamento existente.</p></div>
      {editable && <form className="grid gap-3 border-b border-white/10 bg-black/15 p-5 md:grid-cols-[10rem_8rem_1fr_auto] md:items-end sm:p-7" onSubmit={(event) => save(event, 'new')}>
        <label className="text-sm font-bold text-zinc-300">Data<input className="field mt-2" max={`${competence.referenceMonth.slice(0, 7)}-31`} min={competence.referenceMonth} name="workDate" required type="date" /></label>
        <label className="text-sm font-bold text-zinc-300">Horas<input className="field mt-2" max="24" min="0.01" name="hours" placeholder="8" required step="0.01" type="number" /></label>
        <label className="text-sm font-bold text-zinc-300">Observação<input className="field mt-2" maxLength={1000} name="observation" placeholder="Atividades realizadas" /></label>
        <button className="button-primary" disabled={Boolean(busy)}>{busy === 'new' ? 'Salvando…' : 'Adicionar'}</button>
      </form>}
      <div className="divide-y divide-white/8">
        {entries.length === 0 && <p className="px-7 py-10 text-center text-sm text-zinc-500">Nenhuma hora lançada nesta competência.</p>}
        {entries.map((entry) => <form className="grid gap-3 px-5 py-4 md:grid-cols-[10rem_8rem_1fr_auto] md:items-end sm:px-7" key={entry.id} onSubmit={(event) => save(event, entry.id)}>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">Data<input className="field mt-2" defaultValue={entry.workDate} disabled={!editable} max={`${competence.referenceMonth.slice(0, 7)}-31`} min={competence.referenceMonth} name="workDate" required type="date" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">Horas<input className="field mt-2" defaultValue={decimalHours(entry.minutes)} disabled={!editable} max="24" min="0.01" name="hours" required step="0.01" type="number" /></label>
          <label className="text-xs font-bold uppercase tracking-wider text-zinc-600">Observação<input className="field mt-2" defaultValue={entry.observation || ''} disabled={!editable} maxLength={1000} name="observation" /></label>
          {editable ? <div className="flex gap-2"><button className="button-secondary" disabled={Boolean(busy)}>{busy === entry.id ? 'Salvando…' : 'Salvar'}</button><button className="pressable rounded-full px-3 py-2 text-sm font-bold text-red-300" disabled={Boolean(busy)} onClick={() => remove(entry.id)} type="button">Excluir</button></div> : <p className="pb-3 text-sm font-bold text-zinc-500">{hours(entry.minutes)}</p>}
        </form>)}
      </div>
    </section>

    <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/50 p-5 sm:p-7"><h2 className="text-lg font-black text-white">Histórico de competências</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{history.map((item) => <div className="rounded-2xl border border-white/8 bg-black/20 p-4" key={item.id}><p className="font-bold capitalize text-white">{monthLabel(item.referenceMonth)}</p><p className="mt-2 text-sm text-zinc-400">{hours(item.totalMinutes)} · {statusLabels[item.status] || item.status}</p></div>)}</div></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-36 rounded-2xl border border-white/10 bg-zinc-900/70 p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-2 font-black text-white">{value}</p></div>; }
