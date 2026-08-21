import type { Identity } from '@/lib/identity/module';

export function roleDestination(identity: Pick<Identity, 'role'>) {
  return identity.role === 'manager' ? '/gestao' : '/portal';
}

export function identityDestination(identity: Pick<Identity, 'role' | 'mustChangePassword'>) {
  return identity.mustChangePassword ? '/alterar-senha' : roleDestination(identity);
}
