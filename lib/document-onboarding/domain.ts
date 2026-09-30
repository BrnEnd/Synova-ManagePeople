import type { DocumentOnboardingFormData } from '@/lib/db/schema';
import type { DocumentType } from '@/lib/documents/module';
import type { OnboardingEmploymentType, OnboardingItemStatus, OnboardingRequestStatus } from '@/lib/document-onboarding/types';

export type { OnboardingEmploymentType, OnboardingItemStatus, OnboardingRequestStatus } from '@/lib/document-onboarding/types';

export type OnboardingItemDefinition = {
  key: string;
  label: string;
  description: string;
  documentType: DocumentType;
  required: boolean;
};

const cltChecklist: OnboardingItemDefinition[] = [
  { key: 'identification', label: 'RG ou CIN', description: 'Envie frente e verso, quando houver.', documentType: 'identification', required: true },
  { key: 'voter_registration', label: 'Título de eleitor', description: 'Cópia simples ou documento digital.', documentType: 'voter_registration', required: true },
  { key: 'address_proof', label: 'Comprovante de endereço', description: 'Documento recente e legível.', documentType: 'address_proof', required: true },
  { key: 'dependent_certificate', label: 'Documentos dos dependentes', description: 'Obrigatório apenas nas situações indicadas no formulário.', documentType: 'dependent_certificate', required: false },
  { key: 'military_certificate', label: 'Certificado de reservista', description: 'Obrigatório para homens.', documentType: 'military_certificate', required: false },
  { key: 'marriage_certificate', label: 'Certidão de casamento', description: 'Envie o documento ou marque que não se aplica.', documentType: 'marriage_certificate', required: false },
  { key: 'medical_admission', label: 'Atestado de Saúde Ocupacional (ASO)', description: 'Envie após realizar o exame admissional.', documentType: 'medical_admission', required: true },
  { key: 'work_card', label: 'Carteira de Trabalho (CTPS)', description: 'Informe o número e envie o comprovante.', documentType: 'work_card', required: true },
  { key: 'photo', label: 'Foto 3x4', description: 'Foto recente, nítida e de frente.', documentType: 'photo', required: true },
  { key: 'pis_proof', label: 'PIS/NIS ou Cartão Cidadão', description: 'Informe o número ou envie um comprovante.', documentType: 'pis_proof', required: false },
];

const pjChecklist: OnboardingItemDefinition[] = [
  { key: 'cnpj_card', label: 'Cartão CNPJ', description: 'Comprovante de inscrição e situação cadastral.', documentType: 'cnpj_card', required: true },
  { key: 'address_proof', label: 'Comprovante de residência', description: 'Documento recente e legível.', documentType: 'address_proof', required: true },
  { key: 'contract', label: 'Contrato assinado', description: 'Opcional. A Synova poderá anexar o contrato posteriormente.', documentType: 'contract', required: false },
];

export function onboardingChecklist(employmentType: OnboardingEmploymentType) {
  return employmentType === 'clt' ? cltChecklist : pjChecklist;
}

export function requiredOnboardingItemKeys(
  employmentType: OnboardingEmploymentType,
  data: DocumentOnboardingFormData,
) {
  const required = new Set(onboardingChecklist(employmentType).filter((item) => item.required).map((item) => item.key));
  if (employmentType === 'clt') {
    if (data.gender === 'male') required.add('military_certificate');
    if (!data.marriageCertificateNotApplicable) required.add('marriage_certificate');
    if (data.dependents?.some((dependent) => dependent.familyAllowance || dependent.specialProofRequired)) {
      required.add('dependent_certificate');
    }
  }
  return required;
}

function present(value: string | undefined) {
  return Boolean(value?.trim());
}

export function validateOnboardingSubmission(input: {
  employmentType: OnboardingEmploymentType;
  data: DocumentOnboardingFormData;
  itemStatuses: Record<string, OnboardingItemStatus>;
}) {
  const errors: string[] = [];
  const hasFile = (key: string) => ['uploaded', 'approved'].includes(input.itemStatuses[key] ?? 'pending');

  for (const [key, status] of Object.entries(input.itemStatuses)) {
    if (status === 'rejected') {
      errors.push(`Reenvie: ${onboardingChecklist(input.employmentType).find((item) => item.key === key)?.label ?? key}.`);
    }
  }

  for (const key of requiredOnboardingItemKeys(input.employmentType, input.data)) {
    if (!hasFile(key)) errors.push(`Envie: ${onboardingChecklist(input.employmentType).find((item) => item.key === key)?.label ?? key}.`);
  }

  if (input.employmentType === 'clt') {
    if (!present(input.data.cpf)) errors.push('Informe o CPF.');
    if (!present(input.data.phone)) errors.push('Informe o telefone.');
    if (!input.data.gender) errors.push('Informe o gênero.');
    if (!input.data.raceColor) errors.push('Informe raça/cor ou selecione “Prefiro não informar”.');
    if (!present(input.data.workCardNumber)) errors.push('Informe o número da CTPS.');
    if (!present(input.data.pisNumber) && !hasFile('pis_proof')) errors.push('Informe o número do PIS/NIS ou envie um comprovante.');
    if (typeof input.data.transportationVoucher !== 'boolean') errors.push('Informe se utilizará vale-transporte.');
    if (input.data.transportationVoucher && (!Number.isInteger(input.data.tripsPerDay) || (input.data.tripsPerDay ?? 0) < 1)) {
      errors.push('Informe a quantidade de passagens utilizadas por dia.');
    }
    if (typeof input.data.monthlyAdvance !== 'boolean') errors.push('Informe se deseja adiantamento mensal de 40%.');
    if (!input.data.truthDeclaration) errors.push('Confirme a declaração de veracidade.');

    for (const [index, dependent] of (input.data.dependents ?? []).entries()) {
      if (!present(dependent.name) || !present(dependent.birthDate) || !present(dependent.cpf) || !present(dependent.relationship)) {
        errors.push(`Preencha todos os dados do dependente ${index + 1}.`);
      }
    }
  }

  return errors;
}

export function isReviewComplete(statuses: OnboardingItemStatus[]) {
  return statuses.length > 0 && statuses.every((status) => status === 'approved' || status === 'not_applicable');
}

export function isItemReviewable(status: OnboardingItemStatus, reviewable: boolean) {
  return status === 'uploaded' && reviewable;
}

export function canUploadOnboardingItem(
  requestStatus: OnboardingRequestStatus,
  itemStatus: OnboardingItemStatus,
  reviewable: boolean,
) {
  if (requestStatus === 'in_progress') return itemStatus === 'pending' || itemStatus === 'uploaded';
  if (requestStatus === 'changes_requested') {
    return itemStatus === 'rejected' || (itemStatus === 'uploaded' && !reviewable);
  }
  return false;
}
