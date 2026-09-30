'use client';

import { upload } from '@vercel/blob/client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { DocumentOnboardingFormData } from '@/lib/db/schema';
import type { PublicOnboardingDetail } from '@/lib/document-onboarding/service';
import { documentPathPrefix } from '@/lib/documents/module';
import { portalPath } from '@/lib/routing/base-path';

function safeName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-180) || 'documento';
}

const raceOptions = [
  ['white', 'Branca'], ['black', 'Preta'], ['brown', 'Parda'], ['yellow', 'Amarela'],
  ['indigenous', 'Indígena'], ['prefer_not_to_say', 'Prefiro não informar'],
] as const;

export function PublicDocumentationForm({ detail, token }: { detail: PublicOnboardingDetail; token: string }) {
  const router = useRouter();
  const [data, setData] = useState<DocumentOnboardingFormData>(detail.request.data);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(true);
  const initialized = useRef(false);
  const editable = detail.request.status === 'in_progress' || detail.request.status === 'changes_requested';
  const fieldsEditable = detail.request.status === 'in_progress';

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    if (!editable) return;
    const timer = window.setTimeout(async () => {
      const response = await fetch(portalPath(`/api/documentation/${encodeURIComponent(token)}/draft`), {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data),
      });
      if (response.ok) setSaved(true);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, editable, token]);

  function patchData(patch: Partial<DocumentOnboardingFormData>) {
    setSaved(false);
    setData((current) => ({ ...current, ...patch }));
  }

  async function uploadFiles(itemKey: string, event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setBusy(itemKey); setError(''); setMessage('');
    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: o arquivo deve possuir no máximo 25 MB.`);
        if (detail.blobEnabled) {
          const tenantId = token.split('.')[0];
          const pathname = `${documentPathPrefix(tenantId, detail.employee.id)}${crypto.randomUUID()}-${safeName(file.name)}`;
          const blob = await upload(pathname, file, {
            access: 'private', handleUploadUrl: portalPath('/api/documentation/upload'), multipart: file.size > 5 * 1024 * 1024,
            clientPayload: JSON.stringify({ token, itemKey, originalName: file.name }),
          });
          const completion = await fetch(portalPath(`/api/documentation/${encodeURIComponent(token)}/complete`), {
            method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemKey, originalName: file.name, pathname: blob.pathname }),
          });
          const body = await completion.json() as { error?: string };
          if (!completion.ok) throw new Error(body.error || 'Não foi possível concluir o arquivo.');
        } else {
          const form = new FormData(); form.set('itemKey', itemKey); form.set('file', file);
          const response = await fetch(portalPath(`/api/documentation/${encodeURIComponent(token)}/documents`), { method: 'POST', body: form });
          const body = await response.json() as { error?: string };
          if (!response.ok) throw new Error(body.error || 'Não foi possível enviar o arquivo.');
        }
      }
      setMessage(files.length === 1 ? 'Arquivo salvo.' : `${files.length} arquivos salvos.`);
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível enviar o arquivo.');
    } finally {
      event.target.value = '';
      setBusy(null);
    }
  }

  async function submit() {
    setBusy('submit'); setError(''); setMessage('');
    try {
      const draft = await fetch(portalPath(`/api/documentation/${encodeURIComponent(token)}/draft`), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      if (!draft.ok) throw new Error(((await draft.json()) as { error?: string }).error || 'Não foi possível salvar os dados.');
      const response = await fetch(portalPath(`/api/documentation/${encodeURIComponent(token)}/submit`), { method: 'POST' });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível enviar a documentação.');
      setMessage('Documentação enviada para análise da Synova.');
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível enviar a documentação.');
    } finally {
      setBusy(null);
    }
  }

  function addDependent() {
    patchData({ dependents: [...(data.dependents ?? []), { id: crypto.randomUUID(), name: '', birthDate: '', cpf: '', relationship: '', incomeTax: false, familyAllowance: false }] });
  }

  function updateDependent(id: string, patch: Record<string, string | boolean>) {
    patchData({ dependents: (data.dependents ?? []).map((dependent) => dependent.id === id ? { ...dependent, ...patch } : dependent) });
  }

  const expiresAt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(detail.request.expiresAt));

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Portal Synova</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Documentação de admissão</h1>
        <p className="mt-3 text-zinc-400">Olá, {detail.employee.fullName}. Envie arquivos legíveis em PDF, JPEG, PNG ou WebP, com até 25 MB cada.</p>
        <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">Este link é individual e expira em <strong>{expiresAt}</strong>.</div>

        {!editable && <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">{detail.request.status === 'approved' ? 'Documentação aprovada. Você não precisa realizar nenhuma ação.' : 'Documentação enviada. O formulário está bloqueado enquanto a Synova realiza a análise.'}</div>}
        {detail.request.status === 'changes_requested' && <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">Reenvie somente os itens marcados para correção. Os itens aprovados permanecem preservados.</div>}
        <div aria-live="polite" className="mt-5 space-y-3">
          {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
          {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
        </div>

        {detail.request.employmentType === 'clt' && (
          <section className="mt-7 rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-widest text-orange-400">Dados pessoais</p><h2 className="mt-2 text-xl font-black">Informações obrigatórias</h2></div>{editable && <span className="text-xs text-zinc-500">{saved ? 'Rascunho salvo' : 'Salvando…'}</span>}</div>
            <fieldset className="mt-6 grid gap-4 sm:grid-cols-2" disabled={!fieldsEditable}>
              <label className="text-sm font-bold text-zinc-300">CPF<input className="field mt-2" inputMode="numeric" value={data.cpf ?? ''} onChange={(event) => patchData({ cpf: event.target.value })} /></label>
              <label className="text-sm font-bold text-zinc-300">Telefone<input className="field mt-2" inputMode="tel" value={data.phone ?? ''} onChange={(event) => patchData({ phone: event.target.value })} /></label>
              <label className="text-sm font-bold text-zinc-300">Gênero<select className="field mt-2" value={data.gender ?? ''} onChange={(event) => patchData({ gender: event.target.value as 'male' | 'female' || undefined })}><option value="">Selecione</option><option value="male">Masculino</option><option value="female">Feminino</option></select></label>
              <label className="text-sm font-bold text-zinc-300">Raça/cor<select className="field mt-2" value={data.raceColor ?? ''} onChange={(event) => patchData({ raceColor: event.target.value as DocumentOnboardingFormData['raceColor'] })}><option value="">Selecione</option>{raceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="text-sm font-bold text-zinc-300">Número da CTPS<input className="field mt-2" value={data.workCardNumber ?? ''} onChange={(event) => patchData({ workCardNumber: event.target.value })} /></label>
              <label className="text-sm font-bold text-zinc-300">Número do PIS/NIS <span className="font-normal text-zinc-500">(ou envie arquivo)</span><input className="field mt-2" value={data.pisNumber ?? ''} onChange={(event) => patchData({ pisNumber: event.target.value })} /></label>
              <label className="text-sm font-bold text-zinc-300">Vale-transporte<select className="field mt-2" value={data.transportationVoucher === undefined ? '' : String(data.transportationVoucher)} onChange={(event) => patchData({ transportationVoucher: event.target.value === '' ? undefined : event.target.value === 'true', tripsPerDay: event.target.value === 'true' ? data.tripsPerDay : undefined })}><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select></label>
              {data.transportationVoucher && <label className="text-sm font-bold text-zinc-300">Passagens por dia<input className="field mt-2" min={1} type="number" value={data.tripsPerDay ?? ''} onChange={(event) => patchData({ tripsPerDay: event.target.value ? Number(event.target.value) : undefined })} /></label>}
              <label className="text-sm font-bold text-zinc-300">Adiantamento mensal de 40%<select className="field mt-2" value={data.monthlyAdvance === undefined ? '' : String(data.monthlyAdvance)} onChange={(event) => patchData({ monthlyAdvance: event.target.value === '' ? undefined : event.target.value === 'true' })}><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select></label>
              <label className="flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm text-zinc-300 sm:col-span-2"><input className="mt-1 size-4 accent-orange-500" type="checkbox" checked={data.marriageCertificateNotApplicable ?? false} onChange={(event) => patchData({ marriageCertificateNotApplicable: event.target.checked })} /><span><strong className="block text-white">Certidão de casamento não se aplica</strong>Desmarque e envie a certidão caso se aplique.</span></label>
            </fieldset>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between gap-3"><div><h3 className="font-black">Dependentes</h3><p className="mt-1 text-sm text-zinc-500">Informe somente dependentes para IRRF ou salário-família.</p></div>{fieldsEditable && <button className="rounded-xl border border-white/15 px-3 py-2 text-sm font-bold hover:bg-white/5" type="button" onClick={addDependent}>Adicionar</button>}</div>
              <div className="mt-4 space-y-4">{(data.dependents ?? []).map((dependent, index) => <fieldset className="rounded-2xl border border-white/10 p-4" disabled={!fieldsEditable} key={dependent.id}><div className="flex items-center justify-between"><strong>Dependente {index + 1}</strong>{fieldsEditable && <button className="text-sm text-red-300" type="button" onClick={() => patchData({ dependents: data.dependents?.filter((item) => item.id !== dependent.id) })}>Remover</button>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><input className="field" placeholder="Nome completo" value={dependent.name} onChange={(event) => updateDependent(dependent.id, { name: event.target.value })} /><input className="field" type="date" value={dependent.birthDate} onChange={(event) => updateDependent(dependent.id, { birthDate: event.target.value })} /><input className="field" placeholder="CPF" value={dependent.cpf} onChange={(event) => updateDependent(dependent.id, { cpf: event.target.value })} /><input className="field" placeholder="Parentesco" value={dependent.relationship} onChange={(event) => updateDependent(dependent.id, { relationship: event.target.value, specialProofRequired: ['enteado', 'tutelado', 'menor sob guarda'].includes(event.target.value.toLowerCase()) })} /><label className="flex gap-2 text-sm text-zinc-300"><input type="checkbox" checked={dependent.incomeTax} onChange={(event) => updateDependent(dependent.id, { incomeTax: event.target.checked })} /> Dependente para IRRF</label><label className="flex gap-2 text-sm text-zinc-300"><input type="checkbox" checked={dependent.familyAllowance} onChange={(event) => updateDependent(dependent.id, { familyAllowance: event.target.checked })} /> Salário-família</label></div></fieldset>)}</div>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900 p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-widest text-orange-400">Checklist</p><h2 className="mt-2 text-xl font-black">Documentos</h2>
          <div className="mt-5 space-y-4">{detail.items.map((item) => {
            const canUpload = editable && item.status !== 'approved' && (detail.request.status === 'in_progress' || item.status === 'rejected');
            return <div className={`rounded-2xl border p-4 ${item.status === 'rejected' ? 'border-red-400/30 bg-red-400/5' : 'border-white/10 bg-black/20'}`} key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-black">{item.label} {item.required && <span className="text-orange-400">*</span>}</h3><p className="mt-1 text-sm text-zinc-500">{item.status === 'rejected' ? item.rejectionReason : item.files.length ? `${item.files.filter((file) => file.active).length} arquivo(s) enviado(s)` : 'Nenhum arquivo enviado'}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">{{ pending: 'Pendente', uploaded: 'Enviado', approved: 'Aprovado', rejected: 'Corrigir', not_applicable: 'Não se aplica' }[item.status]}</span></div>{canUpload && <label className="mt-4 block cursor-pointer rounded-xl bg-white px-4 py-3 text-center text-sm font-black text-zinc-950 hover:bg-zinc-200"><input className="sr-only" type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy === item.key} onChange={(event) => uploadFiles(item.key, event)} />{busy === item.key ? 'Enviando…' : item.files.some((file) => file.active) ? 'Adicionar outro arquivo' : 'Selecionar arquivo ou foto'}</label>}</div>;
          })}</div>
        </section>

        {detail.request.employmentType === 'clt' && fieldsEditable && <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-zinc-900 p-5 text-sm text-zinc-300"><input className="mt-1 size-4 accent-orange-500" type="checkbox" checked={data.truthDeclaration ?? false} onChange={(event) => patchData({ truthDeclaration: event.target.checked })} /><span>Declaro que as informações e os documentos enviados são verdadeiros e estão atualizados.</span></label>}
        {editable && <button className="mt-6 w-full rounded-2xl bg-gradient-to-r from-orange-600 to-orange-400 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={Boolean(busy)} onClick={submit}>{busy === 'submit' ? 'Enviando…' : detail.request.status === 'changes_requested' ? 'Reenviar correções' : 'Enviar documentação para análise'}</button>}
        <p className="mt-5 text-center text-xs leading-5 text-zinc-600">Seus dados serão usados somente para o processo de admissão e obrigações legais relacionadas.</p>
      </div>
    </main>
  );
}
