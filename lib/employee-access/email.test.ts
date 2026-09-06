import { describe, expect, test } from 'vitest';
import {
  PORTAL_ACCESS_RECIPIENTS,
  createPortalAccessNotifier,
  portalAccessEmail,
} from '@/lib/employee-access/email';

describe('e-mail interno de criação de acesso', () => {
  test('endereça somente os três responsáveis internos e inclui as credenciais', () => {
    const message = portalAccessEmail({
      employeeName: 'Ana <Souza>',
      username: 'ana@example.com',
      temporaryPassword: 'Senha<&>#2026',
    }, 'https://www.synovadigital.com.br/portal/');

    expect(message).toEqual(expect.objectContaining({
      from: 'Synova Digital <vagas@synovadigital.com.br>',
      to: PORTAL_ACCESS_RECIPIENTS,
      subject: 'Ana <Souza> - Criação de usuário Portal Synova',
    }));
    expect(message.to).toEqual([
      'bruno.alexandrino@synovadigital.com.br',
      'richard@synovadigital.com.br',
      'carolina@synovadigital.com.br',
    ]);
    expect(message.html).toContain('https://www.synovadigital.com.br/portal/entrar');
    expect(message.html).toContain('ana@example.com');
    expect(message.html).toContain('Senha&lt;&amp;&gt;#2026');
    expect(message.html).not.toContain('Ana <Souza>');
    expect(message.text).toContain('Senha<&>#2026');
    expect(message).not.toHaveProperty('replyTo');
    expect(message).not.toHaveProperty('cc');
    expect(message).not.toHaveProperty('bcc');
  });

  test('remove quebras de linha do assunto', () => {
    const message = portalAccessEmail({
      employeeName: 'Ana\r\nBcc: terceiro@example.com',
      username: 'ana@example.com',
      temporaryPassword: 'Synova#2026!Inicial',
    }, 'https://www.synovadigital.com.br/portal');

    expect(message.subject).toBe('Ana Bcc: terceiro@example.com - Criação de usuário Portal Synova');
  });

  test('entrega a mensagem pelo transporte configurado e propaga falhas', async () => {
    const delivered: unknown[] = [];
    const input = {
      employeeName: 'Ana Souza',
      username: 'ana@example.com',
      temporaryPassword: 'Synova#2026!Inicial',
    };
    const notifier = createPortalAccessNotifier({
      canonicalPortalUrl: 'https://www.synovadigital.com.br/portal',
      send: async (message) => { delivered.push(message); return { error: null }; },
    });

    await notifier(input);
    expect(delivered).toEqual([portalAccessEmail(input, 'https://www.synovadigital.com.br/portal')]);

    const failing = createPortalAccessNotifier({
      canonicalPortalUrl: 'https://www.synovadigital.com.br/portal',
      send: async () => ({ error: { message: 'Resend indisponível' } }),
    });
    await expect(failing(input)).rejects.toThrow('Resend indisponível');
  });
});
