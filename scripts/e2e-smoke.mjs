import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import postgres from 'postgres';
import { del } from '@vercel/blob';
import { upload } from '@vercel/blob/client';

const appUrl = process.env.APP_URL || 'http://localhost:3000';
const required = ['PROVISIONING_SECRET', 'DATABASE_URL', 'PROVISIONING_DATABASE_URL'];
for (const name of required) if (!process.env[name]) throw new Error(`${name} não configurada.`);

class BrowserSession {
  cookie = '';
  async request(path, init = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set('cookie', this.cookie);
    const response = await fetch(`${appUrl}${path}`, { ...init, headers, redirect: 'manual' });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';', 1)[0];
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error(`${init.method || 'GET'} ${path} retornou ${response.status}: ${JSON.stringify(body)}`);
    return { response, body };
  }
  json(path, method, body) {
    return this.request(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  }
}

const suffix = randomUUID().slice(0, 8);
const slug = `e2e-${suffix}`;
const managerEmail = `gestor-${suffix}@e2e.local`;
const employeeEmail = `funcionario-${suffix}@e2e.local`;
const temporaryPassword = `Temp#${suffix}Aa1!`;
const managerPassword = `Gestor#${suffix}Aa2!`;
const employeePassword = `Pessoa#${suffix}Aa3!`;
const monthParts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
const month = `${monthParts.find((part) => part.type === 'year').value}-${monthParts.find((part) => part.type === 'month').value}`;
const tenantIds = [];
const blobPaths = [];
const normal = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const privileged = postgres(process.env.PROVISIONING_DATABASE_URL, { max: 1, prepare: false });

async function provision(path, body) {
  const response = await fetch(`${appUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${process.env.PROVISIONING_SECRET}`, 'idempotency-key': `e2e-${randomUUID()}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(`Provisionamento ${path} retornou ${response.status}: ${JSON.stringify(result)}`);
  return result;
}

async function loginAndChange(session, email, currentPassword, newPassword) {
  await session.json('/api/auth/session', 'POST', { tenantSlug: slug, email, password: currentPassword });
  await session.json('/api/auth/password', 'POST', { currentPassword, newPassword });
}

async function uploadBlobDocument(session, pathname, file, payload) {
  const blob = await upload(pathname, file, { access: 'private', handleUploadUrl: `${appUrl}/api/documents/upload`, headers: { cookie: session.cookie }, clientPayload: JSON.stringify(payload) });
  blobPaths.push(blob.pathname);
  const completed = await session.json('/api/documents/complete', 'POST', { ...payload, pathname: blob.pathname });
  return completed.body.document;
}

try {
  const tenantResult = await provision('/api/internal/provisioning/tenants', { name: `Tenant E2E ${suffix}`, slug });
  const tenantId = tenantResult.tenant.id;
  tenantIds.push(tenantId);
  const managerResult = await provision('/api/internal/provisioning/users', { tenantId, email: managerEmail, displayName: 'Gestora E2E', role: 'manager', temporaryPassword });
  const employeeUserResult = await provision('/api/internal/provisioning/users', { tenantId, email: employeeEmail, displayName: 'Funcionária E2E', role: 'employee', temporaryPassword });

  const manager = new BrowserSession();
  await loginAndChange(manager, managerEmail, temporaryPassword, managerPassword);
  const createdEmployee = await manager.json('/api/employees', 'POST', { fullName: 'Funcionária E2E', email: employeeEmail });
  const employeeId = createdEmployee.body.employee.id;
  const identificationFile = new File(['%PDF-1.4\nE2E identification'], 'identificacao.pdf', { type: 'application/pdf' });
  if (process.env.E2E_BLOB === 'true') await uploadBlobDocument(manager, `tenants/${tenantId}/employees/${employeeId}/${randomUUID()}-identificacao.pdf`, identificationFile, { employeeId, type: 'identification', originalName: identificationFile.name });
  else {
    const identification = new FormData();
    identification.set('type', 'identification');
    identification.set('file', identificationFile);
    await manager.request(`/api/employees/${employeeId}/documents`, { method: 'POST', body: identification });
  }
  await manager.json(`/api/employees/${employeeId}`, 'PATCH', { fullName: 'Funcionária E2E', personalEmail: employeeEmail, corporateEmail: `corporativo-${suffix}@synova.local`, phone: '+55 11 99999-9999', identificationDocument: `DOC-${suffix}`, address: { street: 'Rua E2E', city: 'São Paulo', state: 'SP', postalCode: '01000-000', country: 'Brasil' }, entryDate: `${month}-01`, professionalTitle: 'Consultora', employmentType: 'pj', status: 'active' });
  await provision(`/api/internal/provisioning/users/${employeeUserResult.user.id}/employee`, { tenantId, employeeId });

  const clientResult = await manager.json('/api/clients', 'POST', { name: 'Cliente E2E', legalName: 'Cliente E2E Ltda', taxId: null, contactName: null, email: null, phone: null, address: null, observations: null });
  await manager.json(`/api/employees/${employeeId}/contracts`, 'POST', { contractType: 'Prestação de serviços', startDate: `${month}-01`, endDate: null, documentId: null, observations: null });
  await manager.json(`/api/employees/${employeeId}/financial-conditions`, 'POST', { hourlyRateCents: 10_000, effectiveFrom: `${month}-01`, observations: null });
  const allocationResult = await manager.json(`/api/employees/${employeeId}/allocations`, 'POST', { clientId: clientResult.body.client.id, managerUserId: managerResult.user.id, roleTitle: 'Consultora', startDate: `${month}-01`, endDate: null, observations: null });
  await manager.json(`/api/allocations/${allocationResult.body.allocation.id}/commercial-conditions`, 'POST', { hourlyRateCents: 20_000, effectiveFrom: `${month}-01`, observations: null });

  const employee = new BrowserSession();
  await loginAndChange(employee, employeeEmail, temporaryPassword, employeePassword);
  const opened = await employee.json('/api/portal/competencies', 'POST', { month });
  const competenceId = opened.body.competence.id;
  await employee.json(`/api/portal/competencies/${competenceId}/entries`, 'POST', { workDate: `${month}-03`, minutes: 570, observation: 'Fluxo completo E2E' });
  await employee.request(`/api/portal/competencies/${competenceId}/submit`, { method: 'POST' });
  await manager.request(`/api/management/competencies/${competenceId}/approve`, { method: 'POST' });

  const approved = await employee.request(`/api/portal/competencies/${competenceId}`);
  const forecastDocumentId = approved.body.competence.forecastDocumentId;
  if (!forecastDocumentId) throw new Error('Previsão não foi vinculada após a aprovação.');
  const forecast = await employee.request(`/api/documents/${forecastDocumentId}/download`);
  if (!String(forecast.body).startsWith('%PDF')) throw new Error('Previsão baixada não é um PDF válido.');

  const invoiceFile = new File(['%PDF-1.4\nE2E invoice'], 'nota-fiscal.pdf', { type: 'application/pdf' });
  const receiptFile = new File(['%PDF-1.4\nE2E receipt'], 'comprovante.pdf', { type: 'application/pdf' });
  let paid;
  if (process.env.E2E_BLOB === 'true') {
    await uploadBlobDocument(employee, `tenants/${tenantId}/employees/${employeeId}/competencies/${competenceId}/${randomUUID()}-nota-fiscal.pdf`, invoiceFile, { employeeId, competenceId, type: 'invoice', originalName: invoiceFile.name });
    const receiptDocument = await uploadBlobDocument(manager, `tenants/${tenantId}/employees/${employeeId}/competencies/${competenceId}/${randomUUID()}-comprovante.pdf`, receiptFile, { employeeId, type: 'payment_receipt', originalName: receiptFile.name });
    paid = await manager.json(`/api/management/competencies/${competenceId}/payment`, 'POST', { receiptDocumentId: receiptDocument.id, paidDate: `${month}-20`, notes: 'Pagamento E2E' });
  } else {
    const invoice = new FormData();
    invoice.set('file', invoiceFile);
    await employee.request(`/api/portal/competencies/${competenceId}/invoice`, { method: 'POST', body: invoice });
    const receipt = new FormData();
    receipt.set('paidDate', `${month}-20`);
    receipt.set('notes', 'Pagamento E2E');
    receipt.set('file', receiptFile);
    paid = await manager.request(`/api/management/competencies/${competenceId}/payment`, { method: 'POST', body: receipt });
  }
  if (paid.body.payment.amountCents !== 95_000) throw new Error(`Valor pago incorreto: ${paid.body.payment.amountCents}`);

  const dashboard = await manager.request('/gestao');
  for (const text of ['Previsão de pagamento', 'R$ 950,00', 'Previsão de faturamento', 'R$ 1.900,00']) if (!dashboard.body.includes(text)) throw new Error(`Dashboard não contém: ${text}`);
  const portal = await employee.request('/portal');
  for (const text of ['Histórico de competências e pagamentos', 'Pagamento realizado', 'Nota Fiscal', 'Comprovante']) if (!portal.body.includes(text)) throw new Error(`Portal não contém: ${text}`);
  console.log(`E2E aprovado: tenant=${slug} competence=${competenceId} amount=95000 forecast=PDF dashboard=valid portal=valid`);
} finally {
  for (const tenantId of tenantIds) {
    await normal.begin(async (transaction) => {
      await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
      const storedDocuments = await transaction`select pathname from documents where tenant_id = ${tenantId}`;
      for (const document of storedDocuments) if (!blobPaths.includes(document.pathname)) blobPaths.push(document.pathname);
      for (const table of ['login_attempts', 'employee_notes', 'payments', 'notifications', 'competence_events', 'time_entries', 'competencies', 'commercial_conditions', 'financial_conditions', 'allocations', 'contracts', 'documents', 'clients', 'external_hiring_records', 'employees']) await transaction.unsafe(`delete from ${table} where tenant_id = $1`, [tenantId]);
    });
    await privileged.begin(async (transaction) => {
      for (const table of ['idempotency_records', 'audit_events', 'service_keys', 'users']) await transaction.unsafe(`delete from ${table} where tenant_id = $1`, [tenantId]);
      await transaction`delete from tenants where id = ${tenantId}`;
    });
    await rm(new URL(`../.data/uploads/tenants/${tenantId}`, import.meta.url), { recursive: true, force: true });
  }
  if (blobPaths.length && process.env.BLOB_READ_WRITE_TOKEN) await del(blobPaths, { token: process.env.BLOB_READ_WRITE_TOKEN });
  await Promise.all([normal.end(), privileged.end()]);
}
