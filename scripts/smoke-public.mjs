const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const headers = process.env.PORTAL_PROXY_SECRET
  ? { 'x-synova-portal-proxy': process.env.PORTAL_PROXY_SECRET }
  : undefined;
const response = await fetch(`${appUrl}/portal/entrar`, { headers, redirect: 'manual' });
const html = await response.text();

if (response.status !== 200) {
  throw new Error(`A página de login respondeu HTTP ${response.status}.`);
}

for (const expected of ['Bem-vindo à Synova.', 'Portal de funcionários', 'Uso interno Synova']) {
  if (!html.includes(expected)) throw new Error(`A página de login não contém: ${expected}`);
}

for (const removed of [
  'Da competência ao pagamento, tudo em um só lugar.',
  'Gestão operacional, documentos e histórico financeiro com segurança desde o primeiro acesso.',
]) {
  if (html.includes(removed)) throw new Error(`A página de login ainda contém o texto removido: ${removed}`);
}

console.log(`Smoke público aprovado em ${appUrl}/portal/entrar.`);
