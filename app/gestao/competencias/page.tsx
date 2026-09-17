import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ManagementHeader } from '@/components/management/management-header';
import { getApprovalsModule } from '@/lib/approvals/server';
import { getCurrentIdentity } from '@/lib/identity/server';
import type { CompetenceStatus } from '@/lib/timekeeping/module';
import { managementScope } from '@/lib/management/scope';

const allowedStatuses = ['awaiting_approval', 'awaiting_invoice', 'awaiting_payment', 'paid'] as const;
const labels: Record<string, string> = { awaiting_approval: 'Aguardando aprovação', awaiting_invoice: 'Aguardando Nota Fiscal', awaiting_payment: 'Aguardando pagamento', paid: 'Pagamento realizado' };
const hours = (minutes: number) => `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}min` : ''}`;

export default async function CompetenciesPage({ searchParams }: { searchParams: Promise<{ status?: string; scope?: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/funcionario');
  const query = await searchParams;
  const requested = query.status;
  const scope = managementScope(query.scope);
  const status = allowedStatuses.find((item) => item === requested);
  const statuses: CompetenceStatus[] = status ? [status] : ['awaiting_approval', 'awaiting_payment'];
  const reviews = await getApprovalsModule().listForManager(identity.tenantId, identity.id, statuses, scope);
  const title = status ? labels[status] : 'Pendências de competências';

  const statusQuery = status ? `&status=${status}` : '';
  return <main className="min-h-screen"><ManagementHeader active="competencies" displayName={identity.displayName} tenantSlug={identity.tenantSlug} /><div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12"><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Fila de trabalho</p><h1 className="mt-2 text-3xl font-black text-white">{title}</h1><p className="mt-2 text-zinc-400">{reviews.length} competência(s) no escopo selecionado.</p><nav aria-label="Escopo das competências" className="mt-5 flex w-fit rounded-full border border-white/10 bg-zinc-900/70 p-1"><Link className={`rounded-full px-4 py-2 text-sm font-bold ${scope === 'mine' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`} href={`/gestao/competencias?scope=mine${statusQuery}`}>Sob minha gestão</Link><Link className={`rounded-full px-4 py-2 text-sm font-bold ${scope === 'all' ? 'bg-orange-500 text-white' : 'text-zinc-400'}`} href={`/gestao/competencias?scope=all${statusQuery}`}>Todos</Link></nav><div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reviews.length === 0 ? <p className="rounded-3xl border border-white/10 bg-zinc-900/60 p-7 text-zinc-500">Nenhuma competência neste filtro.</p> : reviews.map((review) => <Link className="pressable rounded-3xl border border-white/10 bg-zinc-900/70 p-6 hover:border-orange-400/30" href={`/gestao/competencias/${review.competence.id}?scope=${scope}`} key={review.competence.id}><div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-wider text-zinc-600">{review.competence.referenceMonth.slice(0, 7)}</p><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-300">{labels[review.competence.status] || review.competence.status}</span></div><h2 className="mt-3 text-xl font-black text-white">{review.competence.employeeName}</h2><p className="mt-2 text-sm text-zinc-400">{review.competence.clientName} · Gestor: {review.competence.managerName}</p><p className="mt-5 text-2xl font-black text-orange-300">{hours(review.competence.totalMinutes)}</p></Link>)}</div></div></main>;
}
