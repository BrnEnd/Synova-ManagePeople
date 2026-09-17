export type ManagementScope = 'mine' | 'all';

export function managementScope(value: string | string[] | undefined): ManagementScope {
  return value === 'all' ? 'all' : 'mine';
}
