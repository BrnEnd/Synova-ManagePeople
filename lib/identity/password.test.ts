import { expect, test } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/identity/password';

test('a senha armazenada pode ser verificada sem guardar o valor original', async () => {
  const stored = await hashPassword('Synova#2026!Inicial');

  await expect(verifyPassword('Synova#2026!Inicial', stored)).resolves.toBe(true);
  await expect(verifyPassword('Outra#2026!Senha', stored)).resolves.toBe(false);
  expect(stored.hash).not.toContain('Synova');
  expect(stored.salt).not.toBe('');
});
