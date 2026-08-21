import type { Identity } from '@/lib/identity/module';

export type ManagerAccess = 'allowed' | 'unauthenticated' | 'password_change_required' | 'forbidden';

export function managerAccess(identity: Identity | null): ManagerAccess {
  if (!identity) return 'unauthenticated';
  if (identity.mustChangePassword) return 'password_change_required';
  return identity.role === 'manager' ? 'allowed' : 'forbidden';
}

export function managerAccessResponse(access: Exclude<ManagerAccess, 'allowed'>) {
  if (access === 'unauthenticated') {
    return Response.json({ error: 'Não autenticado.' }, { status: 401 });
  }
  if (access === 'password_change_required') {
    return Response.json({ error: 'Troque a senha temporária antes de continuar.' }, { status: 403 });
  }
  return Response.json({ error: 'Acesso não permitido.' }, { status: 403 });
}
