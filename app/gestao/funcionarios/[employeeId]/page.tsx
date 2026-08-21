import { notFound, redirect } from 'next/navigation';
import { EmployeeDetail } from '@/components/employees/employee-detail';
import { WorkforcePanel } from '@/components/employees/workforce-panel';
import { ManagementHeader } from '@/components/management/management-header';
import { getDocumentsModule } from '@/lib/documents/server';
import { isBlobStorageConfigured } from '@/lib/documents/storage';
import { getEmployeesModule } from '@/lib/employees/server';
import { getCurrentIdentity } from '@/lib/identity/server';
import { getWorkforceModule } from '@/lib/workforce/server';

export default async function EmployeeDetailPage({
  params,
}: PageProps<'/gestao/funcionarios/[employeeId]'>) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');

  const { employeeId } = await params;
  const [detail, documents, workforce] = await Promise.all([
    getEmployeesModule().detail(identity.tenantId, employeeId),
    getDocumentsModule().listForEmployee(identity.tenantId, employeeId),
    getWorkforceModule().detail(identity.tenantId, employeeId),
  ]);
  if (!detail || !workforce) notFound();

  return (
    <main className="min-h-screen">
      <ManagementHeader active="employees" displayName={identity.displayName} tenantSlug={identity.tenantSlug} />
      <EmployeeDetail
        blobEnabled={isBlobStorageConfigured()}
        detail={{
          employee: { ...detail.employee, createdAt: detail.employee.createdAt.toISOString() },
          notes: detail.notes.map((note) => ({ ...note, createdAt: note.createdAt.toISOString() })),
          history: detail.history.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })),
          documents: documents.map((document) => ({ ...document, createdAt: document.createdAt.toISOString() })),
        }}
      />
      <div className="mx-auto max-w-7xl px-5 pb-12 md:px-10">
        <WorkforcePanel
          contractDocuments={documents.filter((document) => document.type === 'contract').map(({ id, originalName }) => ({ id, originalName }))}
          data={workforce}
          employeeId={employeeId}
        />
      </div>
    </main>
  );
}
