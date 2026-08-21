'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

type Condition = { id: string; hourlyRateCents: number; effectiveFrom: string; effectiveTo: string | null; observations: string | null };
export type WorkforcePanelData = {
  contracts: Array<{ id: string; contractType: string; startDate: string; endDate: string | null; status: 'active' | 'ended'; observations: string | null; documentId: string | null }>;
  allocations: Array<{ id: string; clientName: string; managerName: string; roleTitle: string | null; startDate: string; endDate: string | null; status: 'active' | 'ended'; observations: string | null; commercialConditions: Condition[] }>;
  financialConditions: Condition[];
  options: { clients: Array<{ id: string; name: string }>; managers: Array<{ id: string; name: string }> };
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
const value = (form: FormData, key: string) => String(form.get(key) || '').trim();
const optional = (form: FormData, key: string) => value(form, key) || null;

export function WorkforcePanel({ employeeId, data, contractDocuments }: {
  employeeId: string; data: WorkforcePanelData; contractDocuments: Array<{ id: string; originalName: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, endpoint: string, payload: (form: FormData) => object, success: string, key: string) {
    event.preventDefault(); setBusy(key); setFeedback(null);
    const formElement = event.currentTarget;
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload(new FormData(formElement))) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
      formElement.reset(); setFeedback({ type: 'success', text: success }); router.refresh();
    } catch (error) { setFeedback({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível concluir a operação.' }); }
    finally { setBusy(''); }
  }

  async function endPeriod(event: FormEvent<HTMLFormElement>, endpoint: string, label: string, key: string) {
    return submit(event, endpoint, (form) => ({ endDate: value(form, 'endDate') }), `${label} encerrado sem remover o histórico.`, key);
  }

  return (
    <section className="space-y-6" aria-labelledby="workforce-title">
      <div className="border-b border-white/10 pb-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Relações profissionais</p>
        <h2 className="mt-2 text-2xl font-black text-white" id="workforce-title">Contratos, alocações e valores</h2>
        <p className="mt-2 text-sm text-zinc-400">Novas condições criam vigências. Períodos anteriores permanecem preservados.</p>
      </div>

      {feedback && <p aria-live="polite" role={feedback.type === 'error' ? 'alert' : undefined} className={`rounded-xl border px-4 py-3 text-sm ${feedback.type === 'error' ? 'border-red-400/20 bg-red-400/10 text-red-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'}`}>{feedback.text}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
          <h3 className="text-lg font-black text-white">Novo contrato</h3>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => submit(event, `/api/employees/${employeeId}/contracts`, (form) => ({ contractType: value(form, 'contractType'), startDate: value(form, 'startDate'), endDate: optional(form, 'endDate'), documentId: optional(form, 'documentId'), observations: optional(form, 'observations') }), 'Contrato registrado no histórico.', 'contract')}>
            <label className="text-sm font-bold text-zinc-300">Tipo<input className="field mt-2" name="contractType" placeholder="Prestação de serviços" required /></label>
            <label className="text-sm font-bold text-zinc-300">Início<input className="field mt-2" name="startDate" type="date" required /></label>
            <label className="text-sm font-bold text-zinc-300">Fim previsto<input className="field mt-2" name="endDate" type="date" /></label>
            <label className="text-sm font-bold text-zinc-300">Documento<select className="field mt-2" name="documentId"><option value="">Sem vínculo</option>{contractDocuments.map((document) => <option key={document.id} value={document.id}>{document.originalName}</option>)}</select></label>
            <label className="text-sm font-bold text-zinc-300 sm:col-span-2">Observações<textarea className="field mt-2 min-h-20" maxLength={2000} name="observations" /></label>
            <button className="button-primary sm:col-span-2" disabled={Boolean(busy)}>{busy === 'contract' ? 'Registrando…' : 'Registrar contrato'}</button>
          </form>
        </article>

        <article className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
          <h3 className="text-lg font-black text-white">Nova condição financeira</h3>
          <p className="mt-2 text-sm text-zinc-400">Custo do funcionário. O pagamento usará valor-hora vigente × horas aprovadas.</p>
          <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => submit(event, `/api/employees/${employeeId}/financial-conditions`, (form) => ({ hourlyRateCents: Math.round(Number(value(form, 'hourlyRate')) * 100), effectiveFrom: value(form, 'effectiveFrom'), observations: optional(form, 'observations') }), 'Nova condição financeira vigente.', 'financial')}>
            <label className="text-sm font-bold text-zinc-300">Valor-hora (R$)<input className="field mt-2" min="0.01" name="hourlyRate" required step="0.01" type="number" /></label>
            <label className="text-sm font-bold text-zinc-300">Vigência inicial<input className="field mt-2" name="effectiveFrom" required type="date" /></label>
            <label className="text-sm font-bold text-zinc-300 sm:col-span-2">Observações<textarea className="field mt-2 min-h-20" maxLength={2000} name="observations" /></label>
            <button className="button-primary sm:col-span-2" disabled={Boolean(busy)}>{busy === 'financial' ? 'Registrando…' : 'Criar nova vigência'}</button>
          </form>
        </article>
      </div>

      <article className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
        <h3 className="text-lg font-black text-white">Nova alocação</h3>
        <form className="mt-5 grid gap-4 md:grid-cols-3" onSubmit={(event) => submit(event, `/api/employees/${employeeId}/allocations`, (form) => ({ clientId: value(form, 'clientId'), managerUserId: value(form, 'managerUserId'), roleTitle: optional(form, 'roleTitle'), startDate: value(form, 'startDate'), endDate: optional(form, 'endDate'), observations: optional(form, 'observations') }), 'Alocação registrada.', 'allocation')}>
          <label className="text-sm font-bold text-zinc-300">Cliente<select className="field mt-2" name="clientId" required><option value="">Selecione</option>{data.options.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label className="text-sm font-bold text-zinc-300">Gestor responsável<select className="field mt-2" name="managerUserId" required><option value="">Selecione</option>{data.options.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label>
          <label className="text-sm font-bold text-zinc-300">Função<input className="field mt-2" maxLength={160} name="roleTitle" /></label>
          <label className="text-sm font-bold text-zinc-300">Início<input className="field mt-2" name="startDate" required type="date" /></label>
          <label className="text-sm font-bold text-zinc-300">Fim previsto<input className="field mt-2" name="endDate" type="date" /></label>
          <label className="text-sm font-bold text-zinc-300">Observações<input className="field mt-2" maxLength={2000} name="observations" /></label>
          <button className="button-primary md:col-span-3" disabled={Boolean(busy)}>{busy === 'allocation' ? 'Registrando…' : 'Registrar alocação'}</button>
        </form>
      </article>

      <div className="grid gap-6 xl:grid-cols-2">
        <History title="Histórico de contratos" empty="Nenhum contrato registrado.">
          {data.contracts.map((contract) => <div className="border-t border-white/10 py-4 first:border-0" key={contract.id}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-white">{contract.contractType}</p><p className="mt-1 text-sm text-zinc-400">{date(contract.startDate)} → {contract.endDate ? date(contract.endDate) : 'em aberto'}</p></div><Status status={contract.status} /></div>
            {contract.status === 'active' && <form className="mt-3 flex gap-2" onSubmit={(event) => endPeriod(event, `/api/contracts/${contract.id}/end`, 'Contrato', `contract-${contract.id}`)}><input aria-label="Data final do contrato" className="field" name="endDate" min={contract.startDate} required type="date" /><button className="button-secondary shrink-0" disabled={Boolean(busy)}>Encerrar</button></form>}
          </div>)}
        </History>

        <History title="Histórico financeiro" empty="Nenhuma condição financeira registrada.">
          {data.financialConditions.map((condition) => <ConditionRow condition={condition} key={condition.id} />)}
        </History>
      </div>

      <History title="Alocações e condições comerciais" empty="Nenhuma alocação registrada.">
        {data.allocations.map((allocation) => <div className="border-t border-white/10 py-5 first:border-0" key={allocation.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-white">{allocation.clientName}{allocation.roleTitle ? ` · ${allocation.roleTitle}` : ''}</p><p className="mt-1 text-sm text-zinc-400">Gestor: {allocation.managerName} · {date(allocation.startDate)} → {allocation.endDate ? date(allocation.endDate) : 'em aberto'}</p></div><Status status={allocation.status} /></div>
          {allocation.status === 'active' && <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={(event) => submit(event, `/api/allocations/${allocation.id}/commercial-conditions`, (form) => ({ hourlyRateCents: Math.round(Number(value(form, 'hourlyRate')) * 100), effectiveFrom: value(form, 'effectiveFrom'), observations: optional(form, 'observations') }), 'Nova condição comercial vigente.', `commercial-${allocation.id}`)}><input aria-label="Valor-hora comercial" className="field" min="0.01" name="hourlyRate" placeholder="Valor-hora R$" required step="0.01" type="number" /><input aria-label="Início da vigência comercial" className="field" name="effectiveFrom" required type="date" /><input aria-label="Observações comerciais" className="field" name="observations" placeholder="Observações" /><button className="button-secondary" disabled={Boolean(busy)}>Nova vigência</button></form>}
          <div className="mt-3 rounded-2xl bg-black/20 px-4">{allocation.commercialConditions.length ? allocation.commercialConditions.map((condition) => <ConditionRow condition={condition} key={condition.id} />) : <p className="py-3 text-sm text-zinc-500">Sem condição comercial.</p>}</div>
          {allocation.status === 'active' && <form className="mt-3 flex max-w-md gap-2" onSubmit={(event) => endPeriod(event, `/api/allocations/${allocation.id}/end`, 'Alocação', `allocation-${allocation.id}`)}><input aria-label="Data final da alocação" className="field" min={allocation.startDate} name="endDate" required type="date" /><button className="button-secondary shrink-0" disabled={Boolean(busy)}>Encerrar alocação</button></form>}
        </div>)}
      </History>
    </section>
  );
}

function History({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <article className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7"><h3 className="text-lg font-black text-white">{title}</h3><div className="mt-4">{hasChildren ? children : <p className="text-sm text-zinc-500">{empty}</p>}</div></article>;
}
function Status({ status }: { status: 'active' | 'ended' }) { return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${status === 'active' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-white/10 bg-white/5 text-zinc-400'}`}>{status === 'active' ? 'Ativo' : 'Encerrado'}</span>; }
function ConditionRow({ condition }: { condition: Condition }) { return <div className="border-t border-white/10 py-3 first:border-0"><p className="font-bold text-white">{money.format(condition.hourlyRateCents / 100)} / hora</p><p className="mt-1 text-sm text-zinc-400">{date(condition.effectiveFrom)} → {condition.effectiveTo ? date(condition.effectiveTo) : 'vigente'}</p>{condition.observations && <p className="mt-1 text-sm text-zinc-500">{condition.observations}</p>}</div>; }
