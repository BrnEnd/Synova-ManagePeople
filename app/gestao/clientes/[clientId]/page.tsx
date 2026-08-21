import { notFound, redirect } from 'next/navigation';
import { ClientDetail } from '@/components/clients/client-detail';
import { ManagementHeader } from '@/components/management/management-header';
import { getClientsModule } from '@/lib/clients/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export default async function ClientPage({ params }: PageProps<'/gestao/clientes/[clientId]'>) {
  const identity = await getCurrentIdentity();
  if (!identity) redirect('/entrar');
  if (identity.mustChangePassword) redirect('/alterar-senha');
  if (identity.role !== 'manager') redirect('/portal');
  const { clientId } = await params;
  const client = await getClientsModule().get(identity.tenantId, clientId);
  if (!client) notFound();
  return <main className="min-h-screen"><ManagementHeader active="clients" displayName={identity.displayName} tenantSlug={identity.tenantSlug} /><ClientDetail client={{ ...client, createdAt: client.createdAt.toISOString(), updatedAt: client.updatedAt.toISOString() }} /></main>;
}
