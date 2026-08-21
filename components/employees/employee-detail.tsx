'use client';

import { upload } from '@vercel/blob/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { portalPath } from '@/lib/routing/base-path';

type EmployeeDetailData = {
  employee: {
    id: string;
    tenantId: string;
    userId: string | null;
    fullName: string;
    personalEmail: string | null;
    corporateEmail: string | null;
    phone: string | null;
    identificationDocument: string | null;
    address: {
      street: string;
      number?: string;
      complement?: string;
      district?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
    } | null;
    entryDate: string | null;
    professionalTitle: string | null;
    employmentType: string;
    status: 'pre_registration' | 'active' | 'inactive';
    onboardingPending: boolean;
    missingFields: string[];
    createdAt: string;
    inactivatedAt: Date | null;
  };
  documents: Array<{
    id: string;
    type: 'identification' | 'address_proof' | 'contract' | 'payment_forecast' | 'invoice' | 'payment_receipt' | 'other';
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    eventType: string;
    actorName: string | null;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }>;
};

const pendingLabels: Record<string, string> = {
  identificationDocument: 'Documento de identificação',
  phone: 'Telefone',
  personalEmail: 'E-mail pessoal',
  corporateEmail: 'E-mail corporativo',
  address: 'Endereço completo',
  entryDate: 'Data de entrada',
  professionalTitle: 'Cargo ou função',
  identificationDocumentFile: 'Arquivo de identificação',
};

const documentLabels: Record<string, string> = {
  identification: 'Identificação',
  address_proof: 'Comprovante de endereço',
  contract: 'Contrato',
  other: 'Outro documento',
};

const eventLabels: Record<string, string> = {
  'employee.created': 'Funcionário criado',
  'employee.updated': 'Cadastro atualizado',
  'employee.note_added': 'Anotação adicionada',
  'employee.user_associated': 'Acesso associado',
  'employee.inactivated': 'Funcionário inativado',
  'employee.external_pre_registered': 'Pré-cadastro recebido por integração',
  'document.uploaded': 'Documento recebido',
};

function optional(form: FormData, name: string) {
  return String(form.get(name) || '').trim() || null;
}

function safeName(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-180) || 'documento';
}

export function EmployeeDetail({ detail, blobEnabled }: { detail: EmployeeDetailData; blobEnabled: boolean }) {
  const { employee } = detail;
  const router = useRouter();
  const [busy, setBusy] = useState<'profile' | 'document' | 'note' | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function resetFeedback() {
    setMessage('');
    setError('');
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('profile');
    resetFeedback();
    const form = new FormData(event.currentTarget);
    const hasAddress = ['street', 'city', 'state', 'postalCode'].some((field) => optional(form, field));
    const payload = {
      fullName: String(form.get('fullName') || ''),
      personalEmail: optional(form, 'personalEmail'),
      corporateEmail: optional(form, 'corporateEmail'),
      phone: optional(form, 'phone'),
      identificationDocument: optional(form, 'identificationDocument'),
      entryDate: optional(form, 'entryDate'),
      professionalTitle: optional(form, 'professionalTitle'),
      employmentType: String(form.get('employmentType') || 'pj'),
      status: String(form.get('status') || 'pre_registration'),
      address: hasAddress ? {
        street: String(form.get('street') || ''),
        number: String(form.get('number') || '') || undefined,
        complement: String(form.get('complement') || '') || undefined,
        district: String(form.get('district') || '') || undefined,
        city: String(form.get('city') || ''),
        state: String(form.get('state') || ''),
        postalCode: String(form.get('postalCode') || ''),
        country: String(form.get('country') || 'Brasil'),
      } : null,
    };
    try {
      const response = await fetch(portalPath(`/api/employees/${employee.id}`), {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar o cadastro.');
      setMessage('Cadastro atualizado e histórico registrado.');
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível salvar o cadastro.');
    } finally {
      setBusy(null);
    }
  }

  async function sendDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('document');
    setProgress(0);
    resetFeedback();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get('file');
    const type = String(form.get('type'));
    if (!(file instanceof File) || file.size === 0) {
      setError('Selecione um arquivo.');
      setBusy(null);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('O arquivo deve possuir no máximo 25 MB.');
      setBusy(null);
      return;
    }
    try {
      if (blobEnabled) {
        const pathname = `tenants/${employee.tenantId}/employees/${employee.id}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const blob = await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: portalPath('/api/documents/upload'),
          multipart: file.size > 5 * 1024 * 1024,
          clientPayload: JSON.stringify({ employeeId: employee.id, type, originalName: file.name }),
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        const completion = await fetch(portalPath('/api/documents/complete'), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ employeeId: employee.id, type, originalName: file.name, pathname: blob.pathname }),
        });
        const body = await completion.json() as { error?: string };
        if (!completion.ok) throw new Error(body.error || 'Não foi possível concluir o documento.');
      } else {
        const response = await fetch(portalPath(`/api/employees/${employee.id}/documents`), { method: 'POST', body: form });
        const body = await response.json() as { error?: string };
        if (!response.ok) throw new Error(body.error || 'Não foi possível enviar o documento.');
      }
      formElement.reset();
      setMessage('Documento recebido e vinculado ao funcionário.');
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível enviar o documento.');
    } finally {
      setBusy(null);
      setProgress(0);
    }
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('note');
    resetFeedback();
    const formElement = event.currentTarget;
    const content = String(new FormData(formElement).get('content') || '');
    try {
      const response = await fetch(portalPath(`/api/employees/${employee.id}/notes`), {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || 'Não foi possível registrar a anotação.');
      formElement.reset();
      setMessage('Anotação adicionada ao histórico.');
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Não foi possível registrar a anotação.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
      <Link className="text-sm font-bold text-zinc-400 underline-offset-4 hover:text-white hover:underline" href="/gestao/funcionarios">← Voltar para funcionários</Link>
      <div className="mt-6 flex flex-col gap-4 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Cadastro profissional</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">{employee.fullName}</h1>
          <p className="mt-2 text-zinc-400">{employee.professionalTitle || 'Cargo ainda não informado'} · Vínculo {employee.employmentType.toUpperCase()}</p>
        </div>
        <span className={`w-fit rounded-full border px-3 py-1.5 text-sm font-bold ${employee.onboardingPending ? 'border-amber-300/20 bg-amber-300/10 text-amber-200' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200'}`}>
          {employee.onboardingPending ? `${employee.missingFields.length} pendência(s)` : 'Onboarding completo'}
        </span>
      </div>

      <div aria-live="polite" className="mt-5">
        {message && <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          <form className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7" onSubmit={saveProfile}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Perfil</p><h2 className="mt-2 text-xl font-black text-white">Dados do funcionário</h2></div>
              <select className="field w-auto" defaultValue={employee.status === 'inactive' ? 'pre_registration' : employee.status} disabled={employee.status === 'inactive'} name="status">
                <option value="pre_registration">Pré-cadastro</option><option value="active">Ativo</option>
              </select>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-zinc-300 sm:col-span-2">Nome completo<input className="field mt-2" defaultValue={employee.fullName} maxLength={160} name="fullName" required /></label>
              <label className="block text-sm font-bold text-zinc-300">Documento<input className="field mt-2" defaultValue={employee.identificationDocument || ''} maxLength={64} name="identificationDocument" /></label>
              <label className="block text-sm font-bold text-zinc-300">Telefone<input className="field mt-2" defaultValue={employee.phone || ''} maxLength={32} name="phone" /></label>
              <label className="block text-sm font-bold text-zinc-300">E-mail pessoal<input className="field mt-2" defaultValue={employee.personalEmail || ''} maxLength={320} name="personalEmail" type="email" /></label>
              <label className="block text-sm font-bold text-zinc-300">E-mail corporativo<input className="field mt-2" defaultValue={employee.corporateEmail || ''} maxLength={320} name="corporateEmail" type="email" /></label>
              <label className="block text-sm font-bold text-zinc-300">Cargo ou função<input className="field mt-2" defaultValue={employee.professionalTitle || ''} maxLength={160} name="professionalTitle" /></label>
              <label className="block text-sm font-bold text-zinc-300">Data de entrada<input className="field mt-2" defaultValue={employee.entryDate || ''} name="entryDate" type="date" /></label>
              <label className="block text-sm font-bold text-zinc-300">Tipo de vínculo<select className="field mt-2" defaultValue={employee.employmentType} name="employmentType"><option value="pj">PJ</option></select></label>
            </div>
            <div className="mt-8 border-t border-white/10 pt-6"><h3 className="font-black text-white">Endereço</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-bold text-zinc-300 sm:col-span-2">Logradouro<input className="field mt-2" defaultValue={employee.address?.street || ''} maxLength={160} name="street" /></label>
                <label className="block text-sm font-bold text-zinc-300">Número<input className="field mt-2" defaultValue={employee.address?.number || ''} maxLength={32} name="number" /></label>
                <label className="block text-sm font-bold text-zinc-300">Complemento<input className="field mt-2" defaultValue={employee.address?.complement || ''} maxLength={120} name="complement" /></label>
                <label className="block text-sm font-bold text-zinc-300">Bairro<input className="field mt-2" defaultValue={employee.address?.district || ''} maxLength={120} name="district" /></label>
                <label className="block text-sm font-bold text-zinc-300">Cidade<input className="field mt-2" defaultValue={employee.address?.city || ''} maxLength={120} name="city" /></label>
                <label className="block text-sm font-bold text-zinc-300">Estado<input className="field mt-2" defaultValue={employee.address?.state || ''} maxLength={32} name="state" /></label>
                <label className="block text-sm font-bold text-zinc-300">CEP<input className="field mt-2" defaultValue={employee.address?.postalCode || ''} maxLength={24} name="postalCode" /></label>
                <label className="block text-sm font-bold text-zinc-300">País<input className="field mt-2" defaultValue={employee.address?.country || 'Brasil'} maxLength={80} name="country" /></label>
              </div>
            </div>
            <button className="pressable synova-gradient mt-7 rounded-full px-5 py-3 font-black text-white disabled:cursor-wait disabled:opacity-60" disabled={busy !== null || employee.status === 'inactive'} type="submit">{busy === 'profile' ? 'Salvando…' : 'Salvar cadastro'}</button>
          </form>

          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Arquivos</p><h2 className="mt-2 text-xl font-black text-white">Documentos</h2>
            <form className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={sendDocument}>
              <label className="block text-sm font-bold text-zinc-300">Tipo<select className="field mt-2" name="type"><option value="identification">Identificação</option><option value="address_proof">Comprovante de endereço</option><option value="contract">Contrato</option><option value="other">Outro</option></select></label>
              <label className="block text-sm font-bold text-zinc-300">PDF ou imagem<input accept="application/pdf,image/jpeg,image/png,image/webp" className="field mt-2 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-bold file:text-orange-300" name="file" required type="file" /></label>
              <button className="pressable rounded-full border border-orange-400/30 px-5 py-3 font-black text-orange-300 disabled:cursor-wait disabled:opacity-60" disabled={busy !== null} type="submit">{busy === 'document' ? (progress ? `${progress}%` : 'Enviando…') : 'Enviar'}</button>
            </form>
            <p className="mt-3 text-xs text-zinc-600">PDF, JPEG, PNG ou WebP, até 25 MB. Downloads passam pela autorização do tenant.</p>
            <ul className="mt-5 divide-y divide-white/8 border-t border-white/8">
              {detail.documents.length === 0 ? <li className="py-5 text-sm text-zinc-500">Nenhum documento recebido.</li> : detail.documents.map((document) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={document.id}>
                  <div><p className="font-bold text-white">{document.originalName}</p><p className="mt-1 text-xs text-zinc-500">{documentLabels[document.type] || document.type} · {(document.size / 1024 / 1024).toFixed(2)} MB · {new Intl.DateTimeFormat('pt-BR').format(new Date(document.createdAt))}</p></div>
                  <a className="pressable rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300" href={portalPath(`/api/documents/${document.id}/download`)}>Baixar</a>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Gestão</p><h2 className="mt-2 text-xl font-black text-white">Anotações</h2>
            <form className="mt-5" onSubmit={addNote}><label className="sr-only" htmlFor="employee-note">Nova anotação</label><textarea className="field min-h-28 resize-y" id="employee-note" maxLength={4000} minLength={2} name="content" placeholder="Registre uma informação gerencial com contexto…" required /><button className="pressable mt-3 rounded-full border border-white/10 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60" disabled={busy !== null} type="submit">{busy === 'note' ? 'Registrando…' : 'Adicionar anotação'}</button></form>
            <ul className="mt-5 space-y-3">{detail.notes.map((note) => <li className="rounded-2xl border border-white/8 bg-black/20 p-4" key={note.id}><p className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">{note.content}</p><p className="mt-3 text-xs text-zinc-600">{note.authorName} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(note.createdAt))}</p></li>)}</ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Onboarding</p><h2 className="mt-2 text-xl font-black text-white">Pendências</h2>
            {employee.missingFields.length === 0 ? <p className="mt-4 text-sm leading-6 text-emerald-300">Todos os dados básicos e o documento de identificação foram recebidos.</p> : <ul className="mt-4 space-y-2">{employee.missingFields.map((field) => <li className="flex gap-2 text-sm text-zinc-400" key={field}><span className="text-amber-400" aria-hidden="true">•</span>{pendingLabels[field] || field}</li>)}</ul>}
          </section>
          <section className="rounded-3xl border border-white/10 bg-zinc-900/80 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Rastreabilidade</p><h2 className="mt-2 text-xl font-black text-white">Histórico</h2>
            <ol className="mt-5 space-y-5">{detail.history.map((event) => <li className="relative border-l border-white/10 pl-4" key={event.id}><span className="absolute -left-1 top-1 size-2 rounded-full bg-orange-400" aria-hidden="true" /><p className="text-sm font-bold text-zinc-200">{eventLabels[event.eventType] || event.eventType}</p><p className="mt-1 text-xs leading-5 text-zinc-600">{event.actorName || 'Sistema'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.occurredAt))}</p></li>)}</ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
