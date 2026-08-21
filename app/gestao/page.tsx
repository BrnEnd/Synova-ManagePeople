import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ManagementHeader } from '@/components/management/management-header';
import { getDashboardModule } from '@/lib/dashboard/server';
import { getCurrentIdentity } from '@/lib/identity/server';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default async function ManagementPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');
  const dashboard = await getDashboardModule().load(identity.tenantId, identity.id);
  const cards = [
    { label: 'Funcionários ativos', value: dashboard.activeEmployees, detail: 'Cadastros ativos', href: '/gestao/funcionarios?filter=active' },
    { label: 'Novas contratações', value: dashboard.newHires, detail: 'Criadas neste mês', href: '/gestao/funcionarios?filter=new' },
    { label: 'Documentação pendente', value: dashboard.newHiresPending, detail: 'Novas contratações', href: '/gestao/funcionarios?filter=pending' },
    { label: 'Horas não enviadas', value: dashboard.notSubmitted, detail: 'Competência atual' },
    { label: 'Aguardando aprovação', value: dashboard.awaitingApproval, detail: 'Exigem sua análise', href: '/gestao/competencias?status=awaiting_approval' },
    { label: 'Aguardando Nota Fiscal', value: dashboard.awaitingInvoice, detail: 'Pendência do funcionário', href: '/gestao/competencias?status=awaiting_invoice' },
    { label: 'Aguardando pagamento', value: dashboard.awaitingPayment, detail: 'Pendência financeira', href: '/gestao/competencias?status=awaiting_payment' },
    { label: 'Previsão de pagamento', value: money(dashboard.paymentForecastCents), detail: 'Custo aprovado no mês' },
    { label: 'Previsão de faturamento', value: money(dashboard.revenueForecastCents), detail: 'Condições comerciais vigentes' },
  ];

  return <main className="min-h-screen">
    <ManagementHeader active="dashboard" displayName={identity.displayName} tenantSlug={identity.tenantSlug} />
    <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Visão Gestão</p><h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">Painel operacional</h1><p className="mt-2 text-zinc-400">Indicadores da competência atual no fuso de São Paulo.</p></div>
        <div className="w-fit rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">Ambiente configurado</div>
      </div>
      <section aria-label="Indicadores" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const content = <><p className="text-sm font-bold text-zinc-400">{card.label}</p><p className="mt-4 text-3xl font-black tracking-[-0.05em] text-white">{card.value}</p><p className="mt-1 text-sm text-zinc-600">{card.detail}</p></>;
          return card.href ? <Link className="pressable rounded-2xl border border-white/10 bg-zinc-900/65 p-5" href={card.href} key={card.label}>{content}</Link> : <article className="rounded-2xl border border-white/10 bg-zinc-900/65 p-5" key={card.label}>{content}</article>;
        })}
      </section>
    </div>
  </main>;
}
