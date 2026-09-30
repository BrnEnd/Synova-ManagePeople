import { describe, expect, it } from 'vitest';
import { canUploadOnboardingItem, isItemReviewable, requiredOnboardingItemKeys, validateOnboardingSubmission } from '@/lib/document-onboarding/domain';

describe('document onboarding rules', () => {
  it('requires reservist only for male CLT employees', () => {
    expect(requiredOnboardingItemKeys('clt', { gender: 'male', marriageCertificateNotApplicable: true })).toContain('military_certificate');
    expect(requiredOnboardingItemKeys('clt', { gender: 'female', marriageCertificateNotApplicable: true })).not.toContain('military_certificate');
  });

  it('accepts PIS number without a proof file', () => {
    const errors = validateOnboardingSubmission({
      employmentType: 'clt',
      data: {
        cpf: '123', phone: '11999999999', gender: 'female', raceColor: 'prefer_not_to_say',
        workCardNumber: '456', pisNumber: '789', transportationVoucher: false,
        monthlyAdvance: false, marriageCertificateNotApplicable: true, truthDeclaration: true,
      },
      itemStatuses: {
        identification: 'uploaded', voter_registration: 'uploaded', address_proof: 'uploaded',
        medical_admission: 'uploaded', work_card: 'uploaded', photo: 'uploaded',
      },
    });
    expect(errors).toEqual([]);
  });

  it('requires dependent evidence only for family allowance or special relationship proof', () => {
    expect(requiredOnboardingItemKeys('clt', {
      dependents: [{ id: '1', name: 'Ana', birthDate: '2020-01-01', cpf: '1', relationship: 'child', incomeTax: true, familyAllowance: false }],
    })).not.toContain('dependent_certificate');
    expect(requiredOnboardingItemKeys('clt', {
      dependents: [{ id: '1', name: 'Ana', birthDate: '2020-01-01', cpf: '1', relationship: 'child', incomeTax: false, familyAllowance: true }],
    })).toContain('dependent_certificate');
  });

  it('only allows review after the employee submits the current upload round', () => {
    expect(isItemReviewable('uploaded', false)).toBe(false);
    expect(isItemReviewable('uploaded', true)).toBe(true);
    expect(isItemReviewable('approved', true)).toBe(false);
    expect(isItemReviewable('rejected', true)).toBe(false);
  });

  it('only reopens rejected items during a correction round', () => {
    expect(canUploadOnboardingItem('changes_requested', 'rejected', false)).toBe(true);
    expect(canUploadOnboardingItem('changes_requested', 'uploaded', false)).toBe(true);
    expect(canUploadOnboardingItem('changes_requested', 'uploaded', true)).toBe(false);
    expect(canUploadOnboardingItem('changes_requested', 'pending', false)).toBe(false);
    expect(canUploadOnboardingItem('submitted', 'rejected', false)).toBe(false);
  });

  it('requires a new upload when an optional document was rejected', () => {
    const errors = validateOnboardingSubmission({
      employmentType: 'pj',
      data: {},
      itemStatuses: {
        cnpj_card: 'approved',
        address_proof: 'approved',
        contract: 'rejected',
      },
    });

    expect(errors).toContain('Reenvie: Contrato assinado.');
  });
});
