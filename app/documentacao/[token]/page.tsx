import { PublicDocumentationForm } from '@/components/document-onboarding/public-documentation-form';
import { DocumentOnboardingError } from '@/lib/document-onboarding/service';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
import { isBlobStorageConfigured } from '@/lib/documents/storage';

export const dynamic = 'force-dynamic';

export default async function DocumentationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let detail;
  let errorMessage = '';
  try {
    detail = await getDocumentOnboardingService().getPublic(token);
  } catch (error) {
    errorMessage = error instanceof DocumentOnboardingError ? error.message : 'Não foi possível abrir este formulário.';
  }
  if (!detail) return <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-5 text-white"><div className="max-w-md rounded-3xl border border-white/10 bg-zinc-900 p-7 text-center"><p className="text-xs font-black uppercase tracking-widest text-orange-400">Portal Synova</p><h1 className="mt-3 text-2xl font-black">Link indisponível</h1><p className="mt-3 text-zinc-400">{errorMessage}</p><p className="mt-5 text-sm text-zinc-500">Entre em contato com o responsável pelo seu processo de admissão.</p></div></main>;
  return <PublicDocumentationForm detail={{ ...detail, blobEnabled: isBlobStorageConfigured() }} token={token} />;
}
