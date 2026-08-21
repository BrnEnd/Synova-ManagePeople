import { notFound, redirect } from 'next/navigation';
import { CompetenceReview } from '@/components/management/competence-review';
import { ManagementHeader } from '@/components/management/management-header';
import { getApprovalsModule } from '@/lib/approvals/server';
import { getCurrentIdentity } from '@/lib/identity/server';
import { isBlobStorageConfigured } from '@/lib/documents/storage';
export default async function CompetencePage({ params }: PageProps<'/gestao/competencias/[competenceId]'>) { const identity = await getCurrentIdentity(); if (!identity) redirect('/entrar'); if (identity.mustChangePassword) redirect('/alterar-senha'); if (identity.role !== 'manager') redirect('/portal'); const { competenceId } = await params; const review = await getApprovalsModule().getForManager(identity.tenantId, identity.id, competenceId).catch(() => null); if (!review) notFound(); return <main className="min-h-screen"><ManagementHeader active="competencies" displayName={identity.displayName} tenantSlug={identity.tenantSlug} /><CompetenceReview blobEnabled={isBlobStorageConfigured()} review={{ ...review, events: review.events.map((event) => ({ ...event, occurredAt: event.occurredAt.toISOString() })) }} /></main>; }
