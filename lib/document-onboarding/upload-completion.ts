import { canUploadOnboardingItem, onboardingChecklist } from '@/lib/document-onboarding/domain';
import { DocumentOnboardingError } from '@/lib/document-onboarding/service';
import { documentPathPrefix, type EmployeeDocument } from '@/lib/documents/module';
import { documentMetadata } from '@/lib/documents/storage';
import { parseOnboardingToken } from '@/lib/document-onboarding/token';

type OnboardingUploadCompletionService = {
  getPublic(token: string): Promise<{
    employee: { id: string };
    request: { employmentType: 'clt' | 'pj'; status: import('@/lib/document-onboarding/domain').OnboardingRequestStatus };
    items: Array<{ key: string; status: import('@/lib/document-onboarding/domain').OnboardingItemStatus; reviewable: boolean }>;
  }>;
  completeStoredDocument(input: {
    token: string;
    itemKey: string;
    originalName: string;
    pathname: string;
    mimeType: string;
    size: number;
    expected?: { tenantId: string; employeeId: string; documentType: EmployeeDocument['type'] };
  }): Promise<{ document: EmployeeDocument; replayed: boolean }>;
};

export async function completeOnboardingBlobUpload(
  input: {
    token: string;
    itemKey: string;
    originalName: string;
    pathname: string;
    expected?: { tenantId: string; employeeId: string; documentType: EmployeeDocument['type'] };
  },
  dependencies: { onboarding: OnboardingUploadCompletionService },
) {
  const parsed = parseOnboardingToken(input.token);
  if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
  const detail = await dependencies.onboarding.getPublic(input.token);
  const definition = onboardingChecklist(detail.request.employmentType).find((item) => item.key === input.itemKey);
  const item = detail.items.find((candidate) => candidate.key === input.itemKey);
  if (!definition || !item || !canUploadOnboardingItem(detail.request.status, item.status, item.reviewable)) {
    throw new DocumentOnboardingError('Este item não está disponível para envio nesta etapa.', 409);
  }
  if (!input.pathname.startsWith(documentPathPrefix(parsed.tenantId, detail.employee.id))) {
    throw new DocumentOnboardingError('Contexto inválido.', 422);
  }
  if (input.expected && (
    input.expected.tenantId !== parsed.tenantId
    || input.expected.employeeId !== detail.employee.id
    || input.expected.documentType !== definition.documentType
  )) {
    throw new DocumentOnboardingError('Contexto assinado inválido.', 422);
  }
  const metadata = await documentMetadata(input.pathname);
  if (!metadata || metadata.pathname !== input.pathname) throw new DocumentOnboardingError('Documento não encontrado.', 404);
  return dependencies.onboarding.completeStoredDocument({
    token: input.token, itemKey: input.itemKey, originalName: input.originalName,
    pathname: input.pathname, mimeType: metadata.mimeType, size: metadata.size, expected: input.expected,
  });
}
