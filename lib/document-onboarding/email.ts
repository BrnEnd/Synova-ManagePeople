import 'server-only';
import { Resend } from 'resend';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!);
}

export type DocumentationEmailInput = {
  employeeName: string;
  personalEmail: string;
  token: string;
  expiresAt: Date;
  kind: 'request' | 'correction' | 'extension';
};

export function documentationEmail(input: DocumentationEmailInput, canonicalPortalUrl: string) {
  const url = `${canonicalPortalUrl.replace(/\/+$/, '')}/documentacao/${encodeURIComponent(input.token)}`;
  const expiration = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(input.expiresAt);
  const correction = input.kind === 'correction';
  const subject = correction ? 'Correção de documentos — Synova' : 'Envio de documentos — Synova';
  const introduction = correction
    ? 'Alguns itens precisam de correção. Use o mesmo fluxo para reenviar somente o que foi reprovado.'
    : 'A Synova disponibilizou seu formulário individual para envio da documentação de admissão.';
  return {
    from: 'Synova Digital <vagas@synovadigital.com.br>',
    to: [input.personalEmail],
    subject,
    html: `<h1>${escapeHtml(subject)}</h1><p>Olá, ${escapeHtml(input.employeeName)}.</p><p>${escapeHtml(introduction)}</p><p><a href="${escapeHtml(url)}">Acessar formulário de documentação</a></p><p><strong>Este link é individual e expira em ${escapeHtml(expiration)}.</strong> Não o compartilhe.</p>`,
    text: `${subject}\n\nOlá, ${input.employeeName}.\n\n${introduction}\n\n${url}\n\nEste link é individual e expira em ${expiration}. Não o compartilhe.`,
  };
}

export async function sendDocumentationEmail(input: DocumentationEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const canonicalPortalUrl = process.env.CANONICAL_PORTAL_URL;
  if (!apiKey || !canonicalPortalUrl) throw new Error('RESEND_API_KEY ou CANONICAL_PORTAL_URL não configurado.');
  const result = await new Resend(apiKey).emails.send(documentationEmail(input, canonicalPortalUrl));
  if (result.error) throw new Error(result.error.message || 'Falha ao enviar e-mail de documentação.');
}
