import { notFound, redirect } from 'next/navigation';
import { CompetenceReview } from '@/components/management/competence-review';
import { ManagementHeader } from '@/components/management/management-header';
import { getApprovalsModule } from '@/lib/approvals/server';
import { getCurrentIdentity } from '@/lib/identity/server';
import { isBlobStorageConfigured } from '@/lib/documents/storage';
import { managementScope } from '@/lib/management/scope';
export default async function CompetencePage({ params, searchParams }: PageProps<'/gestao/competencias/[competenceId]'>) { const identity = await getCurrentIdentity(); if (!identity) redirect('/entrar'); if (identity.mustChangePassword) redirect('/alterar-senha'); if (identity.role !== 'manager') redirect('/funcionario'); const { competenceId } = await params; const scope = managementScope((await searchParams).scope); const review = await getApprovalsModule().getForManager(identity.tenantId, identity.id, competenceId, scope).catch(() => null); if (!review) notFound(); return <main className="min-h-screen"><ManagementHeader active="competencies" displayName={identity.displayName} tenantSlug={identity.tenantSlug} /><CompetenceReview blobEnabled={isBlobStorageConfigured()} canManage={review.competence.managerUserId === identity.id} scope={scope} review={{ ...review, events: review.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })) }} /></main>; }
