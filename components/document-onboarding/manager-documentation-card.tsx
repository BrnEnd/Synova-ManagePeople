'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ManagerOnboardingDetail } from '@/lib/document-onboarding/service';
import { portalPath } from '@/lib/routing/base-path';

const statusLabels = {
  in_progress: 'Preenchimento em andamento', submitted: 'Aguardando análise', changes_requested: 'Correção solicitada',
  approved: 'Documentação aprovada', expired: 'Link expirado', cancelled: 'Fluxo cancelado',
};

export function ManagerDocumentationCard({ employeeId, personalEmail, employmentType, status, userId, detail }: {
  employeeId: string;
  personalEmail: string | null;
  employmentType: string;
  status: 'pre_registration' | 'active' | 'inactive';
  userId: string | null;
  detail: ManagerOnboardingDetail | null;
}) {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'clt' | 'pj'>(employmentType === 'clt' ? 'clt' : 'pj');
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canRequestDocumentation = status === 'pre_registration' && !userId;

  async function action(path: string, body?: unknown, success = 'Operação concluída.') {
    setBusy(path || 'create'); setMessage(''); setError('');
    try {
      const response = await fetch(portalPath(`/api/employees/${employeeId}/documentation${path}`), {
        method: 'POST', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json() as { error?: string; notificationStatus?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
      setMessage(result.notificationStatus === 'failed' ? `${success} O e-mail não pôde ser enviado; renove o link para tentar novamente.` : success);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-3xl border border-orange-400/20 bg-zinc-900/80 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-400">Admissão digital</p><h2 className="mt-2 text-xl font-black text-white">Documentação do funcionário</h2><p className="mt-2 text-sm text-zinc-400">O fluxo novo convive com o envio manual existente e só vale para este funcionário.</p></div>{detail && <span className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300">{statusLabels[detail.request.status]}</span>}</div>
      <div aria-live="polite">{message && <p className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}</div>

      {!detail ? <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-sm text-zinc-300">Envie um link individual ao e-mail pessoal. A validade será de 15 dias.</p>{canRequestDocumentation ? <><div className="mt-4 flex flex-col gap-3 sm:flex-row"><select className="field sm:max-w-48" value={selectedType} onChange={(event) => setSelectedType(event.target.value as 'clt' | 'pj')}><option value="clt">CLT</option><option value="pj">PJ</option></select><button className="pressable synova-gradient rounded-full px-5 py-3 font-black text-white disabled:opacity-50" disabled={!personalEmail || Boolean(busy)} type="button" onClick={() => action('', { employmentType: selectedType }, 'Solicitação criada e link enviado por e-mail.')}>{busy ? 'Enviando…' : 'Solicitar documentação'}</button></div>{!personalEmail && <p className="mt-3 text-sm text-amber-300">Cadastre o e-mail pessoal antes de enviar a solicitação.</p>}</> : <p className="mt-3 text-sm text-zinc-500">A admissão digital é restrita a novos pré-cadastros sem acesso ao portal. Este funcionário permanece no fluxo legado.</p>}</div> : <>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-zinc-400"><span>Vínculo <strong className="text-white">{detail.request.employmentType.toUpperCase()}</strong></span><span aria-hidden="true">·</span><span>Validade <strong className="text-white">{new Intl.DateTimeFormat('pt-BR').format(new Date(detail.request.expiresAt))}</strong></span><span aria-hidden="true">·</span><span>Revisão <strong className="text-white">{detail.request.revision}</strong></span></div>
        {detail.request.employmentType === 'clt' && Object.keys(detail.request.data).length > 0 && <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4"><h3 className="font-black text-white">Dados informados pelo funcionário</h3><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-zinc-500">CPF</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.cpf || 'Não informado'}</dd></div><div><dt className="text-zinc-500">Telefone</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.phone || 'Não informado'}</dd></div><div><dt className="text-zinc-500">Gênero</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.gender === 'male' ? 'Masculino' : detail.request.data.gender === 'female' ? 'Feminino' : 'Não informado'}</dd></div><div><dt className="text-zinc-500">Raça/cor</dt><dd className="mt-1 font-bold text-zinc-200">{{ white: 'Branca', black: 'Preta', brown: 'Parda', yellow: 'Amarela', indigenous: 'Indígena', prefer_not_to_say: 'Prefere não informar' }[detail.request.data.raceColor ?? 'prefer_not_to_say']}</dd></div><div><dt className="text-zinc-500">CTPS</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.workCardNumber || 'Não informado'}</dd></div><div><dt className="text-zinc-500">PIS/NIS</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.pisNumber || 'Comprovante em arquivo'}</dd></div><div><dt className="text-zinc-500">Vale-transporte</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.transportationVoucher ? `Sim · ${detail.request.data.tripsPerDay ?? 0} passagens/dia` : 'Não'}</dd></div><div><dt className="text-zinc-500">Adiantamento 40%</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.monthlyAdvance ? 'Sim' : 'Não'}</dd></div><div><dt className="text-zinc-500">Dependentes</dt><dd className="mt-1 font-bold text-zinc-200">{detail.request.data.dependents?.length ?? 0}</dd></div></dl>{(detail.request.data.dependents?.length ?? 0) > 0 && <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">Dependentes</p><ul className="mt-2 space-y-2 text-sm text-zinc-300">{detail.request.data.dependents!.map((dependent) => <li key={dependent.id}>{dependent.name} · CPF {dependent.cpf} · {dependent.relationship}{dependent.incomeTax ? ' · IRRF' : ''}{dependent.familyAllowance ? ' · Salário-família' : ''}</li>)}</ul></div>}</div>}
        <div className="mt-5 space-y-3">{detail.items.map((item) => <article className={`rounded-2xl border p-4 ${item.status === 'rejected' ? 'border-red-400/30 bg-red-400/5' : 'border-white/10 bg-black/20'}`} key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black text-white">{item.label}</h3><p className="mt-1 text-xs text-zinc-500">{item.required ? 'Obrigatório' : 'Condicional ou opcional'} · {{ pending: 'Pendente', uploaded: item.reviewable ? 'Aguardando revisão' : 'Aguardando confirmação do funcionário', approved: 'Aprovado', rejected: 'Reprovado', not_applicable: 'Não se aplica' }[item.status]}</p>{item.rejectionReason && <p className="mt-2 text-sm text-red-200">Motivo: {item.rejectionReason}</p>}</div><div className="flex flex-wrap gap-2">{item.files.filter((file) => file.active).map((file) => <a className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-zinc-300 hover:bg-white/5" href={portalPath(`/api/documents/${file.documentId}/download`)} key={file.id}>Baixar {file.originalName}</a>)}</div></div>{item.status === 'uploaded' && item.reviewable && <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><input className="field" maxLength={500} placeholder="Motivo obrigatório ao reprovar" value={reasons[item.id] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} /><button className="rounded-full border border-red-400/30 px-4 py-2 text-sm font-black text-red-200 disabled:opacity-50" disabled={Boolean(busy) || !(reasons[item.id] ?? '').trim()} type="button" onClick={() => action('/review', { itemId: item.id, decision: 'reject', reason: reasons[item.id] }, 'Correção solicitada e novo link enviado.')}>Reprovar</button><button className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50" disabled={Boolean(busy)} type="button" onClick={() => action('/review', { itemId: item.id, decision: 'approve' }, 'Documento aprovado.')}>Aprovar</button></div>}</article>)}</div>
        <div className="mt-5 flex flex-wrap gap-3">{['in_progress', 'changes_requested', 'expired'].includes(detail.request.status) && <button className="rounded-full border border-white/15 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50" disabled={Boolean(busy)} type="button" onClick={() => action('/renew', undefined, 'Validade renovada por 15 dias e novo link enviado.')}>Renovar link por 15 dias</button>}{detail.request.status === 'in_progress' && !detail.request.hasUploads && <button className="rounded-full border border-red-400/20 px-4 py-2.5 text-sm font-black text-red-200 disabled:opacity-50" disabled={Boolean(busy)} type="button" onClick={() => action('/cancel', undefined, 'Fluxo digital cancelado; o modo legado voltou a ficar ativo.')}>Voltar ao modo legado</button>}</div>
      </>}
    </section>
  );
}
