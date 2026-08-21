import { redirect } from 'next/navigation';
import { EmployeeManager } from '@/components/employees/employee-manager';
import { ManagementHeader } from '@/components/management/management-header';
import { getEmployeesModule } from '@/lib/employees/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');

  const employees = await getEmployeesModule().list(identity.tenantId);
  const filter = (await searchParams).filter;
  const monthParts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
  const monthPrefix = `${monthParts.find((part) => part.type === 'year')?.value}-${monthParts.find((part) => part.type === 'month')?.value}`;
  const filtered = employees.filter((employee) => {
    if (filter === 'active') return employee.status === 'active';
    if (filter === 'new') return employee.createdAt.toISOString().startsWith(monthPrefix);
    if (filter === 'pending') return employee.createdAt.toISOString().startsWith(monthPrefix) && employee.onboardingPending && employee.status !== 'inactive';
    return true;
  });

  return (
    <main className="min-h-screen">
      <ManagementHeader active="employees" displayName={identity.displayName} tenantSlug={identity.tenantSlug} />
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Visão Gestão</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">Funcionários</h1>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-400">Cadastre profissionais, acompanhe pendências de onboarding e preserve o histórico ao inativar.</p>
        </div>
        <EmployeeManager employees={filtered.map((employee) => ({
          ...employee,
          createdAt: employee.createdAt.toISOString(),
        }))} />
      </div>
    </main>
  );
}
