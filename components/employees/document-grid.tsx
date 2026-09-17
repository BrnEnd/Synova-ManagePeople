import Image from 'next/image';
import { portalPath } from '@/lib/routing/base-path';

export type DocumentGridItem = {
  id: string;
  type: 'identification' | 'address_proof' | 'contract' | 'payment_forecast' | 'invoice' | 'payment_receipt' | 'other';
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const labels: Record<DocumentGridItem['type'], string> = {
  identification: 'Identificação',
  address_proof: 'Comprovante de endereço',
  contract: 'Contrato',
  payment_forecast: 'Previsão de pagamento',
  invoice: 'Nota Fiscal',
  payment_receipt: 'Comprovante de pagamento',
  other: 'Outro documento',
};

export function DocumentGrid({ documents }: { documents: DocumentGridItem[] }) {
  if (!documents.length) return <p className="mt-5 text-sm text-zinc-500">Nenhum documento recebido.</p>;
  return <div className="mt-5 grid gap-4 md:grid-cols-2">
    {documents.map((document) => {
      const download = portalPath(`/api/documents/${document.id}/download`);
      const preview = `${download}?preview=1`;
      return <article className="overflow-hidden rounded-2xl border border-white/10 bg-black/20" key={document.id}>
        <header className="p-4">
          <h3 className="font-black text-white">{labels[document.type]}</h3>
          <p className="mt-1 truncate text-sm text-zinc-300">{document.originalName}</p>
          <p className="mt-1 text-xs text-zinc-600">{(document.size / 1024 / 1024).toFixed(2)} MB · {new Intl.DateTimeFormat('pt-BR').format(new Date(document.createdAt))}</p>
        </header>
        <div className="flex min-h-64 items-center justify-center border-y border-white/8 bg-zinc-950">
          {document.mimeType === 'application/pdf' ? <iframe className="h-72 w-full" src={preview} title={`Visualização de ${document.originalName}`} />
            : document.mimeType.startsWith('image/') ? <Image alt={`Visualização de ${document.originalName}`} className="max-h-72 w-full object-contain" height={600} src={preview} unoptimized width={800} />
              : <p className="px-4 text-sm text-zinc-500">Pré-visualização indisponível.</p>}
        </div>
        <div className="p-4"><a className="pressable inline-flex rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-zinc-300" href={download}>Baixar {labels[document.type]}</a></div>
      </article>;
    })}
  </div>;
}
