export type EmployeeAccessAvailability =
  | 'available'
  | 'created'
  | 'inactive'
  | 'onboarding_pending'
  | 'documentation_pending'
  | 'missing_email'
  | 'contract_pending'
  | 'allocation_pending'
  | 'financial_condition_pending'
  | 'commercial_condition_pending';

export type EmployeeOperationalReadiness = {
  hasActiveContract: boolean;
  hasActiveAllocation: boolean;
  hasFinancialCondition: boolean;
  hasCommercialCondition: boolean;
};

export type EmployeeAccessCandidate = {
  userId: string | null;
  personalEmail: string | null;
  status: 'pre_registration' | 'active' | 'inactive';
  onboardingPending: boolean;
  documentationMode: 'legacy' | 'self_service';
  documentationStatus: string;
  operationalReadiness?: EmployeeOperationalReadiness;
};

export function employeeAccessBlockers(employee: EmployeeAccessCandidate): Exclude<EmployeeAccessAvailability, 'available'>[] {
  if (employee.userId) return ['created'];
  if (employee.status !== 'active') return ['inactive'];

  const blockers: Exclude<EmployeeAccessAvailability, 'available'>[] = [];
  if (employee.onboardingPending) blockers.push('onboarding_pending');
  if (employee.documentationMode === 'self_service' && employee.documentationStatus !== 'approved') {
    blockers.push('documentation_pending');
  }
  if (!employee.personalEmail?.trim()) blockers.push('missing_email');
  if (employee.operationalReadiness) {
    if (!employee.operationalReadiness.hasActiveContract) blockers.push('contract_pending');
    if (!employee.operationalReadiness.hasActiveAllocation) blockers.push('allocation_pending');
    if (!employee.operationalReadiness.hasFinancialCondition) blockers.push('financial_condition_pending');
    if (!employee.operationalReadiness.hasCommercialCondition) blockers.push('commercial_condition_pending');
  }
  return blockers;
}

export function employeeAccessAvailability(employee: EmployeeAccessCandidate): EmployeeAccessAvailability {
  return employeeAccessBlockers(employee)[0] ?? 'available';
}
