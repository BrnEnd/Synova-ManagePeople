import { describe, expect, test } from 'vitest';
import { managerAccess } from '@/lib/identity/access';

const manager = {
  id: 'manager-1',
  tenantId: 'tenant-a',
  tenantSlug: 'tenant-a',
  email: 'manager@example.com',
  displayName: 'Gestão',
  role: 'manager' as const,
  mustChangePassword: false,
};

describe('autorização de gestão', () => {
  test('bloqueia funções protegidas enquanto a senha temporária não for trocada', () => {
    expect(managerAccess({ ...manager, mustChangePassword: true })).toBe('password_change_required');
  });

  test('distingue sessão ausente, papel incorreto e gestor autorizado', () => {
    expect(managerAccess(null)).toBe('unauthenticated');
    expect(managerAccess({ ...manager, role: 'employee' })).toBe('forbidden');
    expect(managerAccess(manager)).toBe('allowed');
  });
});
