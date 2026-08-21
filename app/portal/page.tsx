import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/auth/logout-button';
import { EmployeeTimesheet } from '@/components/portal/employee-timesheet';
import { getCurrentIdentity } from '@/lib/identity/server';
import { MissingAllocationError } from '@/lib/timekeeping/module';
import { getTimekeepingModule } from '@/lib/timekeeping/server';

export default async function EmployeePortalPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'employee') redirect('/gestao');

  const monthParts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
  const month = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}`;
  let detail;
  try { detail = await getTimekeepingModule().open({ tenantId: identity.tenantId, userId: identity.id, month }); }
  catch (error) {
    if (!(error instanceof MissingAllocationError)) throw error;
    return <main className="mx-auto flex min-h-screen max-w-5xl items-center px-5 py-10"><section className="w-full rounded-3xl border border-white/10 bg-zinc-900/70 p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Portal do Funcionário</p><h1 className="mt-3 text-3xl font-black text-white">Olá, {identity.displayName}</h1></div><LogoutButton /></div><p className="mt-4 text-zinc-400">Sua competência ainda não pode ser aberta porque não há uma alocação válida para este mês. Procure seu gestor.</p></section></main>;
  }
  const history = await getTimekeepingModule().list(identity.tenantId, identity.id);

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-zinc-950/85 px-5 backdrop-blur md:px-10"><div className="mx-auto flex max-w-7xl items-center justify-between py-4"><div><p className="font-black tracking-[-0.03em] text-white">Synova <span className="text-orange-400">Pessoas</span></p><p className="mt-0.5 text-xs font-bold uppercase tracking-[0.16em] text-zinc-600">{identity.displayName}</p></div><LogoutButton /></div></header>
      <EmployeeTimesheet detail={detail} history={history} />
    </main>
  );
}
