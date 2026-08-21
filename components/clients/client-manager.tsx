'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { portalPath } from '@/lib/routing/base-path';

type ClientItem = { id: string; name: string; legalName: string | null; taxId: string | null; contactName: string | null; email: string | null; phone: string | null; status: 'active' | 'inactive'; createdAt: string };

export function ClientManager({ clients }: { clients: ClientItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [inactivating, setInactivating] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function createClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(''); setError('');
    const formElement = event.currentTarget; const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) || '').trim() || null;
    try {
      const response = await fetch(portalPath('/api/clients'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: value('name'), legalName: value('legalName'), taxId: value('taxId'), contactName: value('contactName'), email: value('email'), phone: value('phone'), address: null, observations: value('observations') }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível criar o cliente.');
      formElement.reset(); setMessage('Cliente criado e pronto para receber alocações.'); router.refresh();
    } catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível criar o cliente.'); } finally { setBusy(false); }
  }

  async function inactivate(client: ClientItem) {
    if (!window.confirm(`Inativar ${client.name}? O histórico será preservado.`)) return;
    setInactivating(client.id); setMessage(''); setError('');
    try { const response = await fetch(portalPath(`/api/clients/${client.id}/inactivate`), { method: 'POST' }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível inativar.'); setMessage(`${client.name} foi inativado.`); router.refresh(); }
    catch (submissionError) { setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível inativar.'); } finally { setInactivating(null); }
  }

  return <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"><section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/65"><div className="border-b border-white/10 px-5 py-5 sm:px-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Carteira</p><h2 className="mt-2 text-xl font-black text-white">{clients.length} cliente{clients.length === 1 ? '' : 's'}</h2></div>{clients.length === 0 ? <div className="px-6 py-16 text-center text-sm text-zinc-500">Nenhum cliente cadastrado.</div> : <ul className="divide-y divide-white/8">{clients.map((client) => <li className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6" key={client.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link className="truncate font-black text-white underline-offset-4 hover:underline" href={`/gestao/clientes/${client.id}`}>{client.name}</Link><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${client.status === 'active' ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200' : 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400'}`}>{client.status === 'active' ? 'Ativo' : 'Inativo'}</span></div><p className="mt-2 truncate text-sm text-zinc-400">{client.legalName || client.contactName || 'Identificação complementar não informada'}</p><p className="mt-1 text-xs text-zinc-600">{client.taxId ? `CNPJ ${client.taxId}` : 'CNPJ não informado'} · {client.email || 'Contato não informado'}</p></div><button className="pressable w-fit rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300 disabled:opacity-40" disabled={client.status === 'inactive' || inactivating === client.id} onClick={() => inactivate(client)} type="button">{inactivating === client.id ? 'Inativando…' : client.status === 'inactive' ? 'Inativo' : 'Inativar'}</button></li>)}</ul>}</section><aside className="h-fit rounded-3xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6 xl:sticky xl:top-6"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Novo cliente</p><h2 className="mt-2 text-xl font-black text-white">Cadastrar cliente</h2><form className="mt-6 space-y-4" onSubmit={createClient}><label className="block text-sm font-bold text-zinc-300">Nome<input className="field mt-2" maxLength={160} name="name" required /></label><label className="block text-sm font-bold text-zinc-300">Razão social<input className="field mt-2" maxLength={200} name="legalName" /></label><label className="block text-sm font-bold text-zinc-300">CNPJ<input className="field mt-2" inputMode="numeric" maxLength={18} name="taxId" /></label><label className="block text-sm font-bold text-zinc-300">Contato<input className="field mt-2" maxLength={160} name="contactName" /></label><label className="block text-sm font-bold text-zinc-300">E-mail<input className="field mt-2" maxLength={320} name="email" type="email" /></label><label className="block text-sm font-bold text-zinc-300">Telefone<input className="field mt-2" maxLength={32} name="phone" /></label><label className="block text-sm font-bold text-zinc-300">Observações<textarea className="field mt-2 min-h-24 resize-y" maxLength={4000} name="observations" /></label><button className="pressable synova-gradient w-full rounded-full px-5 py-3 font-black text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Criando…' : 'Criar cliente'}</button></form><div aria-live="polite" className="mt-4">{message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}{error && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}</div></aside></div>;
}
