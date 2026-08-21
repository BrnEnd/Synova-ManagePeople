import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { getCurrentIdentity } from '@/lib/identity/server';

const cards = [
  { label: 'Funcionários ativos', value: '0', detail: 'Cadastros do tenant' },
  { label: 'Documentos pendentes', value: '0', detail: 'Novas contratações' },
  { label: 'Aguardando aprovação', value: '0', detail: 'Competência atual' },
  { label: 'Aguardando pagamento', value: '0', detail: 'Operação financeira' },
];

export default async function ManagementPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-zinc-950/80 px-5 py-4 backdrop-blur md:px-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div><p className="font-black tracking-[-0.03em] text-white">Synova <span className="text-orange-400">Pessoas</span></p><p className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">{identity.tenantSlug}</p></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm font-bold text-zinc-300 sm:block">{identity.displayName}</span><LogoutButton /></div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Visão Gestão</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">Painel operacional</h1><p className="mt-2 text-zinc-400">A fundação segura do tenant está ativa. Os módulos operacionais serão adicionados nas próximas fatias.</p></div>
          <div className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">Ambiente configurado</div>
        </div>
        <section aria-label="Indicadores" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => <article className="rounded-2xl border border-white/10 bg-zinc-900/65 p-5" key={card.label}><p className="text-sm font-bold text-zinc-400">{card.label}</p><p className="mt-4 text-4xl font-black tracking-[-0.05em] text-white">{card.value}</p><p className="mt-1 text-sm text-zinc-600">{card.detail}</p></article>)}
        </section>
        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/65 p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Próxima etapa</p>
          <h2 className="mt-3 text-2xl font-black text-white">Cadastros operacionais</h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-400">Funcionários, clientes, contratos e alocações formarão o próximo fluxo vertical sobre esta base de identidade e isolamento.</p>
        </section>
      </div>
    </main>
  );
}
