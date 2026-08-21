'use client';

import { upload } from '@vercel/blob/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { portalPath } from '@/lib/routing/base-path';

type Review = {
  competence: {
    id: string; tenantId: string; employeeId: string; employeeName: string; clientName: string;
    referenceMonth: string; totalMinutes: number; status: string; revision: number;
    approvedAmountCents: number | null; invoiceDocumentId: string | null;
  };
  entries: Array<{ id: string; workDate: string; minutes: number; observation: string | null }>;
  events: Array<{ id: string; eventType: string; reason: string | null; actorName: string | null; occurredAt: string }>;
};

const hours = (minutes: number) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`;

export function CompetenceReview({ review, blobEnabled }: { review: Review; blobEnabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function action(endpoint: string, payload?: object) {
    setBusy(endpoint); setError('');
    try {
      const response = await fetch(portalPath(endpoint), { method: 'POST', headers: payload ? { 'content-type': 'application/json' } : undefined, body: payload ? JSON.stringify(payload) : undefined });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível concluir.');
      router.push('/gestao/competencias'); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível concluir.'); }
    finally { setBusy(''); }
  }

  function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    return action(`/api/management/competencies/${review.competence.id}/adjustments`, { reason: String(new FormData(event.currentTarget).get('reason') || '') });
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('payment'); setError('');
    const form = new FormData(event.currentTarget); const file = form.get('file');
    if (!(file instanceof File) || !file.size) { setError('Selecione o comprovante.'); setBusy(''); return; }
    try {
      if (blobEnabled) {
        const originalName = file.name;
        const pathname = `tenants/${review.competence.tenantId}/employees/${review.competence.employeeId}/competencies/${review.competence.id}/${crypto.randomUUID()}-${originalName.replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
        const blob = await upload(pathname, file, { access: 'private', handleUploadUrl: portalPath('/api/documents/upload'), multipart: file.size > 5 * 1024 * 1024, clientPayload: JSON.stringify({ employeeId: review.competence.employeeId, type: 'payment_receipt', originalName }) });
        const completion = await fetch(portalPath('/api/documents/complete'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: review.competence.employeeId, type: 'payment_receipt', originalName, pathname: blob.pathname }) });
        const completed = await completion.json() as { error?: string; document?: { id: string } };
        if (!completion.ok || !completed.document) throw new Error(completed.error || 'Não foi possível concluir o comprovante.');
        const response = await fetch(portalPath(`/api/management/competencies/${review.competence.id}/payment`), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ receiptDocumentId: completed.document.id, notes: String(form.get('notes') || '') || null, paidDate: String(form.get('paidDate') || '') || null }) });
        const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível registrar o pagamento.');
      } else {
        const response = await fetch(portalPath(`/api/management/competencies/${review.competence.id}/payment`), { method: 'POST', body: form });
        const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || 'Não foi possível registrar o pagamento.');
      }
      router.push('/gestao'); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível registrar o pagamento.'); }
    finally { setBusy(''); }
  }

  return <div className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">
    <Link className="text-sm font-bold text-zinc-400 hover:text-white" href="/gestao/competencias">← Voltar para competências</Link>
    <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-7">
      <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Revisão de horas</p><h1 className="mt-2 text-3xl font-black text-white">{review.competence.employeeName}</h1><p className="mt-2 text-zinc-400">{review.competence.clientName} · {review.competence.referenceMonth.slice(0, 7)} · Revisão {review.competence.revision}</p></div>
      <p className="text-3xl font-black text-white">{hours(review.competence.totalMinutes)}</p>
    </div>
    {error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
    <section className="mt-7 overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/70">
      <div className="grid grid-cols-[9rem_7rem_1fr] border-b border-white/10 px-6 py-3 text-xs font-black uppercase tracking-wider text-zinc-600"><span>Data</span><span>Horas</span><span>Observação</span></div>
      {review.entries.map((entry) => <div className="grid grid-cols-[9rem_7rem_1fr] border-b border-white/8 px-6 py-4 text-sm last:border-0" key={entry.id}><span className="text-zinc-300">{new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${entry.workDate}T00:00:00Z`))}</span><span className="font-bold text-white">{hours(entry.minutes)}</span><span className="text-zinc-400">{entry.observation || '—'}</span></div>)}
    </section>
    {review.competence.status === 'awaiting_approval' && <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <form className="rounded-3xl border border-white/10 bg-zinc-900/70 p-6" onSubmit={adjust}><h2 className="font-black text-white">Solicitar ajustes</h2><textarea className="field mt-4 min-h-28" minLength={3} maxLength={2000} name="reason" placeholder="Explique o que precisa ser corrigido" required /><button className="button-secondary mt-3" disabled={Boolean(busy)}>Devolver ao funcionário</button></form>
      <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-6"><h2 className="font-black text-white">Aprovar horas</h2><p className="mt-2 text-sm leading-6 text-zinc-400">Congela o total e o valor-hora vigente e gera a previsão de pagamento.</p><button className="button-primary mt-6" disabled={Boolean(busy)} onClick={() => action(`/api/management/competencies/${review.competence.id}/approve`)} type="button">{busy.includes('approve') ? 'Aprovando…' : 'Aprovar competência'}</button></div>
    </div>}
    {review.competence.status === 'awaiting_payment' && <form className="mt-6 rounded-3xl border border-emerald-400/15 bg-emerald-400/5 p-6" onSubmit={pay}><h2 className="font-black text-white">Registrar pagamento</h2><p className="mt-2 text-sm text-zinc-400">Valor congelado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((review.competence.approvedAmountCents || 0) / 100)}</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold text-zinc-300">Data do pagamento<input className="field mt-2" name="paidDate" required type="date" /></label><label className="text-sm font-bold text-zinc-300">Comprovante<input accept="application/pdf,image/jpeg,image/png,image/webp" className="field mt-2" name="file" required type="file" /></label><label className="text-sm font-bold text-zinc-300">Observações<input className="field mt-2" maxLength={2000} name="notes" /></label></div><button className="button-primary mt-4" disabled={Boolean(busy)}>{busy === 'payment' ? 'Registrando…' : 'Confirmar pagamento'}</button></form>}
    <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/50 p-6"><h2 className="font-black text-white">Histórico do fluxo</h2><ol className="mt-4 space-y-3">{review.events.map((event) => <li className="border-l border-white/10 pl-4" key={event.id}><p className="text-sm font-bold text-zinc-200">{event.eventType}</p><p className="mt-1 text-xs text-zinc-500">{event.actorName || 'Sistema'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.occurredAt))}</p>{event.reason && <p className="mt-1 text-sm text-amber-200">{event.reason}</p>}</li>)}</ol></section>
  </div>;
}
