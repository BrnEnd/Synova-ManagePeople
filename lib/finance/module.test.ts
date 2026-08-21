import { describe, expect, it, vi } from 'vitest';
import { createFinanceModule, InvalidFinanceError, type FinanceRepository } from '@/lib/finance/module';
import { createPaymentForecastPdf } from '@/lib/finance/pdf';

const forecast = { tenantId: 'tenant-a', competenceId: 'competence-a', employeeId: 'employee-a', employeeName: 'Profissional A', clientName: 'Cliente A', referenceMonth: '2026-08-01', revision: 2, approvedMinutes: 570, hourlyRateCents: 10_000, approvedAmountCents: 95_000, approvedAt: new Date('2026-08-21T12:00:00Z'), forecastDocumentId: null };

function setup() {
  let id = 0;
  const repository: FinanceRepository = {
    getForecastData: vi.fn(async () => forecast), linkForecast: vi.fn(async () => true),
    getEmployeeCompetence: vi.fn(async () => ({ employeeId: 'employee-a', status: 'awaiting_invoice' })),
    documentMatches: vi.fn(async (_tenant, documentId, _employee, type) => documentId === `${type}-a`),
    linkInvoice: vi.fn(async () => true), recordPayment: vi.fn(async (_tenant, manager, competence, receipt, notes, paidAt, paymentId, _event, _notification, at) => ({ id: paymentId, tenantId: 'tenant-a', competenceId: competence, employeeId: 'employee-a', amountCents: 95_000, paidAt, notes, receiptDocumentId: receipt, recordedByUserId: manager, createdAt: at })),
    getPayment: vi.fn(async () => null),
  };
  const documents = { recordUpload: vi.fn(async (input) => ({ document: { id: 'forecast-document', ...input, createdAt: new Date(), archivedAt: null }, replayed: false })) };
  const writeDocument = vi.fn(async () => undefined);
  return { repository, documents, writeDocument, module: createFinanceModule({ repository, documents, writeDocument, generateId: () => `id-${++id}`, now: () => new Date('2026-08-21T12:00:00Z') }) };
}

describe('finance module', () => {
  it('gera PDF válido da fotografia aprovada e o vincula uma única vez', async () => {
    const bytes = await createPaymentForecastPdf(forecast);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
    const { module, writeDocument, repository } = setup();
    await expect(module.ensureForecast('tenant-a', 'competence-a')).resolves.toBe('forecast-document');
    expect(writeDocument).toHaveBeenCalledWith(expect.stringContaining('/competencies/competence-a/previsao-pagamento-2026-08-r2.pdf'), expect.any(Uint8Array), 'application/pdf');
    expect(repository.linkForecast).toHaveBeenCalledWith('tenant-a', 'competence-a', 'forecast-document', expect.any(Date));
  });

  it('aceita NF somente no estado e contexto do próprio funcionário', async () => {
    const { module, repository } = setup();
    await expect(module.linkInvoice({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', documentId: 'invoice-a' })).resolves.toBe(true);
    expect(repository.linkInvoice).toHaveBeenCalled();
    await expect(module.linkInvoice({ tenantId: 'tenant-a', userId: 'user-a', competenceId: 'competence-a', documentId: 'other-a' })).rejects.toBeInstanceOf(InvalidFinanceError);
  });

  it('registra sempre o valor congelado e exige comprovante tipado', async () => {
    const { module, repository } = setup();
    await expect(module.recordPayment({ tenantId: 'tenant-a', managerUserId: 'manager-a', competenceId: 'competence-a', receiptDocumentId: 'payment_receipt-a', paidDate: '2026-08-20' })).resolves.toMatchObject({ amountCents: 95_000, paidAt: new Date('2026-08-20T12:00:00Z') });
    expect(repository.recordPayment).toHaveBeenCalledWith('tenant-a', 'manager-a', 'competence-a', 'payment_receipt-a', null, new Date('2026-08-20T12:00:00Z'), expect.any(String), expect.any(String), expect.any(String), expect.any(Date));
    await expect(module.recordPayment({ tenantId: 'tenant-a', managerUserId: 'manager-a', competenceId: 'competence-a', receiptDocumentId: 'invoice-a' })).rejects.toBeInstanceOf(InvalidFinanceError);
    await expect(module.recordPayment({ tenantId: 'tenant-a', managerUserId: 'manager-a', competenceId: 'competence-a', receiptDocumentId: 'payment_receipt-a', paidDate: '20/08/2026' })).rejects.toBeInstanceOf(InvalidFinanceError);
  });
});
