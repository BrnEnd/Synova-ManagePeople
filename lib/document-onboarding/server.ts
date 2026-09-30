import 'server-only';
import { DocumentOnboardingService } from '@/lib/document-onboarding/service';

let instance: DocumentOnboardingService | undefined;

export function getDocumentOnboardingService() {
  instance ??= new DocumentOnboardingService();
  return instance;
}
