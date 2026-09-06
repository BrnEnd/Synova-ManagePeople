import 'server-only';
import { Resend } from 'resend';
import type { AccessNotification } from '@/lib/employee-access/module';

export const PORTAL_ACCESS_RECIPIENTS = [
  'bruno.alexandrino@synovadigital.com.br',
  'richard@synovadigital.com.br',
  'carolina@synovadigital.com.br',
];

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  })[character]!);
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

export function portalAccessEmail(input: AccessNotification, canonicalPortalUrl: string) {
  const portalUrl = `${canonicalPortalUrl.replace(/\/+$/, '')}/entrar`;
  const employeeName = safeHeader(input.employeeName);
  return {
    from: 'Synova Digital <vagas@synovadigital.com.br>',
    to: PORTAL_ACCESS_RECIPIENTS,
    subject: `${employeeName} - Criação de usuário Portal Synova`,
    html: `
      <h1>Acesso criado no Portal Synova</h1>
      <p>O acesso de <strong>${escapeHtml(employeeName)}</strong> foi criado.</p>
      <p><strong>Portal:</strong> <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a></p>
      <p><strong>Usuário:</strong> ${escapeHtml(input.username)}</p>
      <p><strong>Senha temporária:</strong> ${escapeHtml(input.temporaryPassword)}</p>
      <p>O Funcionário deverá trocar a senha no primeiro acesso.</p>
    `,
    text: [
      'Acesso criado no Portal Synova',
      `Funcionário: ${employeeName}`,
      `Portal: ${portalUrl}`,
      `Usuário: ${input.username}`,
      `Senha temporária: ${input.temporaryPassword}`,
      'O Funcionário deverá trocar a senha no primeiro acesso.',
    ].join('\n'),
  };
}

export function createPortalAccessNotifier(dependencies: {
  canonicalPortalUrl: string;
  send: (message: ReturnType<typeof portalAccessEmail>) => Promise<{
    error: { message?: string } | null;
  }>;
}) {
  return async (input: AccessNotification) => {
    const { error } = await dependencies.send(portalAccessEmail(input, dependencies.canonicalPortalUrl));
    if (error) throw new Error(error.message || 'Falha ao enviar e-mail de acesso.');
  };
}

export async function sendPortalAccessNotification(input: AccessNotification) {
  const apiKey = process.env.RESEND_API_KEY;
  const canonicalPortalUrl = process.env.CANONICAL_PORTAL_URL;
  if (!apiKey || !canonicalPortalUrl) {
    throw new Error('RESEND_API_KEY ou CANONICAL_PORTAL_URL não configurado.');
  }

  const resend = new Resend(apiKey);
  return createPortalAccessNotifier({
    canonicalPortalUrl,
    send: (message) => resend.emails.send(message),
  })(input);
}
