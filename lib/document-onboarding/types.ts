export const ONBOARDING_EMPLOYMENT_TYPES = ['clt', 'pj'] as const;
export const ONBOARDING_REQUEST_STATUSES = [
  'in_progress',
  'submitted',
  'changes_requested',
  'approved',
  'expired',
  'cancelled',
] as const;
export const ONBOARDING_ITEM_STATUSES = ['pending', 'uploaded', 'approved', 'rejected', 'not_applicable'] as const;
export const EMPLOYEE_DOCUMENTATION_MODES = ['legacy', 'self_service'] as const;
export const EMPLOYEE_DOCUMENTATION_STATUSES = ['legacy', ...ONBOARDING_REQUEST_STATUSES] as const;

export type OnboardingEmploymentType = typeof ONBOARDING_EMPLOYMENT_TYPES[number];
export type OnboardingRequestStatus = typeof ONBOARDING_REQUEST_STATUSES[number];
export type OnboardingItemStatus = typeof ONBOARDING_ITEM_STATUSES[number];
export type EmployeeDocumentationMode = typeof EMPLOYEE_DOCUMENTATION_MODES[number];
export type EmployeeDocumentationStatus = typeof EMPLOYEE_DOCUMENTATION_STATUSES[number];

export function isOnboardingEmploymentType(value: string): value is OnboardingEmploymentType {
  return ONBOARDING_EMPLOYMENT_TYPES.includes(value as OnboardingEmploymentType);
}

export function isOnboardingRequestStatus(value: string): value is OnboardingRequestStatus {
  return ONBOARDING_REQUEST_STATUSES.includes(value as OnboardingRequestStatus);
}

export function isOnboardingItemStatus(value: string): value is OnboardingItemStatus {
  return ONBOARDING_ITEM_STATUSES.includes(value as OnboardingItemStatus);
}

export function isEmployeeDocumentationMode(value: string): value is EmployeeDocumentationMode {
  return EMPLOYEE_DOCUMENTATION_MODES.includes(value as EmployeeDocumentationMode);
}

export function isEmployeeDocumentationStatus(value: string): value is EmployeeDocumentationStatus {
  return EMPLOYEE_DOCUMENTATION_STATUSES.includes(value as EmployeeDocumentationStatus);
}
