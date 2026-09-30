import { DocumentOnboardingError } from '@/lib/document-onboarding/service';

export function onboardingErrorResponse(error: unknown) {
  if (error instanceof DocumentOnboardingError) return Response.json({ error: error.message }, { status: error.status });
  console.error('Falha no fluxo de documentação:', error);
  return Response.json({ error: 'Não foi possível concluir a operação.' }, { status: 500 });
}
