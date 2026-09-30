import { beforeEach, describe, expect, test, vi } from 'vitest';
import { completeOnboardingBlobUpload } from '@/lib/document-onboarding/upload-completion';
import { documentMetadata } from '@/lib/documents/storage';

vi.mock('@/lib/documents/storage', () => ({ documentMetadata: vi.fn() }));

const tenantId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const employeeId = '33333333-3333-4333-8333-333333333333';
const token = `${tenantId}.${requestId}.this-secret-has-more-than-thirty-two-chars`;
const pathname = `tenants/${tenantId}/employees/${employeeId}/onboarding/cartao-cnpj.pdf`;

function dependencies() {
  return {
    onboarding: {
      getPublic: vi.fn().mockResolvedValue({
        employee: { id: employeeId, fullName: 'Bruna Soares' },
        request: { employmentType: 'pj', status: 'in_progress' },
        items: [{ key: 'cnpj_card', status: 'pending', reviewable: false }],
      }),
      completeStoredDocument: vi.fn().mockResolvedValue({ document: { id: 'document-1' }, replayed: false }),
    },
  };
}

describe('completeOnboardingBlobUpload', () => {
  beforeEach(() => vi.mocked(documentMetadata).mockReset());

  test('não autoriza token bearer malformado', async () => {
    const deps = dependencies();
    await expect(completeOnboardingBlobUpload({ token: 'token-inválido', itemKey: 'cnpj_card', originalName: 'cartao-cnpj.pdf', pathname }, deps))
      .rejects.toMatchObject({ status: 404, message: 'Link inválido.' });
    expect(deps.onboarding.getPublic).not.toHaveBeenCalled();
    expect(deps.onboarding.completeStoredDocument).not.toHaveBeenCalled();
  });

  test('valida o blob e delega o registro e vínculo à única transação de domínio', async () => {
    vi.mocked(documentMetadata).mockResolvedValue({ pathname, mimeType: 'application/pdf', size: 1234 });
    const deps = dependencies();
    await expect(completeOnboardingBlobUpload({
      token, itemKey: 'cnpj_card', originalName: 'cartao-cnpj.pdf', pathname,
      expected: { tenantId, employeeId, documentType: 'cnpj_card' },
    }, deps)).resolves.toMatchObject({ document: { id: 'document-1' } });
    expect(deps.onboarding.completeStoredDocument).toHaveBeenCalledWith(expect.objectContaining({
      token, itemKey: 'cnpj_card', pathname, mimeType: 'application/pdf', size: 1234,
      expected: { tenantId, employeeId, documentType: 'cnpj_card' },
    }));
  });

  test('rejeita callback assinado de outro funcionário antes da transação', async () => {
    vi.mocked(documentMetadata).mockResolvedValue({ pathname, mimeType: 'application/pdf', size: 1234 });
    const deps = dependencies();
    await expect(completeOnboardingBlobUpload({
      token, itemKey: 'cnpj_card', originalName: 'cartao-cnpj.pdf', pathname,
      expected: { tenantId, employeeId: '44444444-4444-4444-8444-444444444444', documentType: 'cnpj_card' },
    }, deps)).rejects.toMatchObject({ status: 422, message: 'Contexto assinado inválido.' });
    expect(deps.onboarding.completeStoredDocument).not.toHaveBeenCalled();
  });

  test.each([
    { status: 404, message: 'Link inválido ou substituído.' },
    { status: 410, message: 'Este link expirou. Solicite à Synova uma nova validade.' },
  ])('não autoriza upload quando o link bearer não é mais válido ($status)', async ({ status, message }) => {
    const deps = dependencies();
    vi.mocked(deps.onboarding.getPublic).mockRejectedValue({ status, message });
    await expect(completeOnboardingBlobUpload({ token, itemKey: 'cnpj_card', originalName: 'cartao-cnpj.pdf', pathname }, deps))
      .rejects.toMatchObject({ status, message });
    expect(documentMetadata).not.toHaveBeenCalled();
    expect(deps.onboarding.completeStoredDocument).not.toHaveBeenCalled();
  });
});
