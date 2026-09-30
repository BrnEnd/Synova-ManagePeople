import { portalPath } from '@/lib/routing/base-path';
import type { DocumentType } from '@/lib/documents/module';

export type DocumentGridItem = {
  id: string;
  type: DocumentType;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const labels: Record<DocumentGridItem['type'], string> = {
  identification: 'Identificação',
  address_proof: 'Comprovante de endereço',
  voter_registration: 'Título de eleitor',
  dependent_certificate: 'Documentos de dependentes',
  military_certificate: 'Certificado de reservista',
  marriage_certificate: 'Certidão de casamento',
  medical_admission: 'ASO admissional',
  work_card: 'Carteira de Trabalho',
  photo: 'Foto 3x4',
  pis_proof: 'Comprovante do PIS/NIS',
  cnpj_card: 'Cartão CNPJ',
  contract: 'Contrato',
  payment_forecast: 'Previsão de pagamento',
  invoice: 'Nota Fiscal',
  payment_receipt: 'Comprovante de pagamento',
  other: 'Outro documento',
};

export function DocumentGrid({ documents }: { documents: DocumentGridItem[] }) {
  if (!documents.length) return <p className="mt-5 text-sm text-zinc-500">Nenhum documento recebido.</p>;
  return <div aria-label="Documentos enviados" className="mt-5 overflow-hidden rounded-2xl border border-white/10" role="table">
    <div className="hidden grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.5fr)_8rem_7rem_auto] gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-black uppercase tracking-wider text-zinc-500 md:grid" role="row">
      <span role="columnheader">Tipo</span><span role="columnheader">Arquivo</span><span role="columnheader">Enviado em</span><span role="columnheader">Tamanho</span><span className="text-right" role="columnheader">Ação</span>
    </div>
    <div className="divide-y divide-white/10" role="rowgroup">
      {documents.map((document) => <div className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(10rem,1fr)_minmax(12rem,1.5fr)_8rem_7rem_auto] md:items-center md:gap-4" key={document.id} role="row">
        <div role="cell"><span className="text-xs font-black uppercase tracking-wider text-zinc-600 md:hidden">Tipo</span><h3 className="mt-1 font-black text-white md:mt-0">{labels[document.type]}</h3></div>
        <div className="min-w-0" role="cell"><span className="text-xs font-black uppercase tracking-wider text-zinc-600 md:hidden">Arquivo</span><p className="mt-1 truncate text-sm text-zinc-300 md:mt-0">{document.originalName}</p></div>
        <div role="cell"><span className="text-xs font-black uppercase tracking-wider text-zinc-600 md:hidden">Enviado em</span><p className="mt-1 text-sm text-zinc-400 md:mt-0">{new Intl.DateTimeFormat('pt-BR').format(new Date(document.createdAt))}</p></div>
        <div role="cell"><span className="text-xs font-black uppercase tracking-wider text-zinc-600 md:hidden">Tamanho</span><p className="mt-1 text-sm text-zinc-400 md:mt-0">{(document.size / 1024 / 1024).toFixed(2)} MB</p></div>
        <div className="md:text-right" role="cell"><a className="pressable inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300" href={portalPath(`/api/documents/${document.id}/download`)}>Baixar</a></div>
      </div>)}
    </div>
  </div>;
}
