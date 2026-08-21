import { redirect } from 'next/navigation';
import { EmployeeManager } from '@/components/employees/employee-manager';
import { ManagementHeader } from '@/components/management/management-header';
import { getEmployeesModule } from '@/lib/employees/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function EmployeesPage() {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');

  const employees = await getEmployeesModule().list(identity.tenantId);

  return (
    <main className="min-h-screen">
      <ManagementHeader active="employees" displayName={identity.displayName} tenantSlug={identity.tenantSlug} />
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-10 md:py-12">
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-orange-400">Visão Gestão</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white md:text-4xl">Funcionários</h1>
          <p className="mt-2 max-w-2xl leading-7 text-zinc-400">Cadastre profissionais, acompanhe pendências de onboarding e preserve o histórico ao inativar.</p>
        </div>
        <EmployeeManager employees={employees.map((employee) => ({
          ...employee,
          createdAt: employee.createdAt.toISOString(),
        }))} />
      </div>
    </main>
  );
}
