import { describe, expect, it } from 'vitest';
import { employeeAccessAvailability, employeeAccessBlockers } from '@/lib/employee-access/policy';

describe('employeeAccessAvailability', () => {
  it('keeps the legacy flow available after the existing onboarding is complete', () => {
    expect(employeeAccessAvailability({ userId: null, personalEmail: 'ana@example.com', status: 'active', onboardingPending: false, documentationMode: 'legacy', documentationStatus: 'legacy' })).toBe('available');
  });

  it('blocks self-service access until documentation approval', () => {
    expect(employeeAccessAvailability({ userId: null, personalEmail: 'ana@example.com', status: 'active', onboardingPending: false, documentationMode: 'self_service', documentationStatus: 'submitted' })).toBe('documentation_pending');
    expect(employeeAccessAvailability({ userId: null, personalEmail: 'ana@example.com', status: 'active', onboardingPending: false, documentationMode: 'self_service', documentationStatus: 'approved' })).toBe('available');
  });

  it('lists every operational relationship that still blocks portal access', () => {
    const employee = {
      userId: null,
      personalEmail: 'ana@example.com',
      status: 'active' as const,
      onboardingPending: false,
      documentationMode: 'self_service' as const,
      documentationStatus: 'approved',
      operationalReadiness: {
        hasActiveContract: false,
        hasActiveAllocation: false,
        hasFinancialCondition: false,
        hasCommercialCondition: false,
      },
    };

    expect(employeeAccessAvailability(employee)).toBe('contract_pending');
    expect(employeeAccessBlockers(employee)).toEqual([
      'contract_pending',
      'allocation_pending',
      'financial_condition_pending',
      'commercial_condition_pending',
    ]);
  });
});
