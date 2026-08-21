import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ManagementHeader } from '@/components/management/management-header';
import { getClientsModule } from '@/lib/clients/server';
import { getEmployeesModule } from '@/lib/employees/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function ManagementPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');
  const [employees, clients] = await Promise.all([
    getEmployeesModule().list(identity.tenantId),
    getClientsModule().list(identity.tenantId),
  ]);
  const cards = [
    { label: 'Funcionários ativos', value: employees.filter((employee) => employee.status === 'active').length, detail: 'Cadastros do tenant', href: '/gestao/funcionarios' },
    { label: 'Documentos pendentes', value: employees.filter((employee) => employee.onboardingPending && employee.status !== 'inactive').length, detail: 'Novas contratações', href: '/gestao/funcionarios' },
    { label: 'Clientes ativos', value: clients.filter((client) => client.status === 'active').length, detail: 'Disponíveis para alocação', href: '/gestao/clientes' },
    { label: 'Aguardando aprovação', value: 0, detail: 'Competência atual' },
    { label: 'Aguardando pagamento', value: 0, detail: 'Operação financeira' },
  ];

  return (
    <main className="min-h-screen">
      <ManagementHeader active="dashboard" displayName={identity.displayName} tenantSlug={identity.tenantSlug} />
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Visão Gestão</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">Painel operacional</h1><p className="mt-2 text-zinc-400">A fundação segura do tenant está ativa. Os módulos operacionais serão adicionados nas próximas fatias.</p></div>
          <div className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">Ambiente configurado</div>
        </div>
        <section aria-label="Indicadores" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => {
            const content = <><p className="text-sm font-bold text-zinc-400">{card.label}</p><p className="mt-4 text-4xl font-black tracking-[-0.05em] text-white">{card.value}</p><p className="mt-1 text-sm text-zinc-600">{card.detail}</p></>;
            return card.href ? <Link className="pressable rounded-2xl border border-white/10 bg-zinc-900/65 p-5" href={card.href} key={card.label}>{content}</Link> : <article className="rounded-2xl border border-white/10 bg-zinc-900/65 p-5" key={card.label}>{content}</article>;
          })}
        </section>
        <section className="mt-6 rounded-3xl border border-white/10 bg-zinc-900/65 p-6 md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Próxima etapa</p>
          <h2 className="mt-3 text-2xl font-black text-white">Cadastros operacionais</h2>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-400">Funcionários e clientes já estão disponíveis. Contratos, alocações e condições formarão o próximo fluxo vertical.</p>
        </section>
      </div>
    </main>
  );
}
