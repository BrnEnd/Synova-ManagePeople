export type EmployeeAccessAvailability =
  | 'available'
  | 'created'
  | 'inactive'
  | 'onboarding_pending'
  | 'missing_email';

export type EmployeeAccessCandidate = {
  userId: string | null;
  personalEmail: string | null;
  status: 'pre_registration' | 'active' | 'inactive';
  onboardingPending: boolean;
};

export function employeeAccessAvailability(employee: EmployeeAccessCandidate): EmployeeAccessAvailability {
  if (employee.userId) return 'created';
  if (employee.status !== 'active') return 'inactive';
  if (employee.onboardingPending) return 'onboarding_pending';
  if (!employee.personalEmail?.trim()) return 'missing_email';
  return 'available';
}
