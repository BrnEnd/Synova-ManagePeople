import type { EmployeeDocument } from '@/lib/documents/module';
import { documentPathPrefix } from '@/lib/documents/module';
import { createPaymentForecastPdf } from '@/lib/finance/pdf';

export type ForecastData = { tenantId: string; competenceId: string; employeeId: string; employeeName: string; clientName: string; referenceMonth: string; revision: number; approvedMinutes: number; hourlyRateCents: number; approvedAmountCents: number; approvedAt: Date; forecastDocumentId: string | null };
export type Payment = { id: string; tenantId: string; competenceId: string; employeeId: string; amountCents: number; paidAt: Date; notes: string | null; receiptDocumentId: string; recordedByUserId: string; createdAt: Date };
export type FinanceRepository = {
  getForecastData(tenantId: string, competenceId: string): Promise<ForecastData | null>;
  linkForecast(tenantId: string, competenceId: string, documentId: string, at: Date): Promise<boolean>;
  getEmployeeCompetence(tenantId: string, userId: string, competenceId: string): Promise<{ employeeId: string; status: string } | null>;
  documentMatches(tenantId: string, documentId: string, employeeId: string, type: EmployeeDocument['type']): Promise<boolean>;
  linkInvoice(tenantId: string, userId: string, competenceId: string, documentId: string, eventId: string, notificationId: string, at: Date): Promise<boolean>;
  recordPayment(tenantId: string, managerUserId: string, competenceId: string, receiptDocumentId: string, notes: string | null, paidAt: Date, paymentId: string, eventId: string, notificationId: string, at: Date): Promise<Payment | null>;
  getPayment(tenantId: string, competenceId: string): Promise<Payment | null>;
};
export type FinanceDocuments = { recordUpload(command: { tenantId: string; employeeId: string; actorUserId: string | null; type: EmployeeDocument['type']; origin: EmployeeDocument['origin']; originalName: string; pathname: string; mimeType: string; size: number }): Promise<{ document: EmployeeDocument; replayed: boolean }> };
export class InvalidFinanceError extends Error { constructor(message: string) { super(message); this.name = 'InvalidFinanceError'; } }

export function createFinanceModule(dependencies: { repository: FinanceRepository; documents: FinanceDocuments; writeDocument: (pathname: string, bytes: Uint8Array, mimeType: string) => Promise<void>; generateId: () => string; now: () => Date }) {
  return {
    getForecastData(tenantId: string, competenceId: string) { return dependencies.repository.getForecastData(tenantId, competenceId); },
    async ensureForecast(tenantId: string, competenceId: string) {
      const data = await dependencies.repository.getForecastData(tenantId, competenceId); if (!data) throw new InvalidFinanceError('A competência ainda não possui fotografia financeira aprovada.');
      if (data.forecastDocumentId) return data.forecastDocumentId;
      const bytes = await createPaymentForecastPdf(data); const originalName = `previsao-pagamento-${data.referenceMonth.slice(0, 7)}-r${data.revision}.pdf`;
      const pathname = `${documentPathPrefix(tenantId, data.employeeId)}competencies/${competenceId}/${originalName}`;
      await dependencies.writeDocument(pathname, bytes, 'application/pdf');
      const result = await dependencies.documents.recordUpload({ tenantId, employeeId: data.employeeId, actorUserId: null, type: 'payment_forecast', origin: 'generated', originalName, pathname, mimeType: 'application/pdf', size: bytes.length });
      await dependencies.repository.linkForecast(tenantId, competenceId, result.document.id, dependencies.now()); return result.document.id;
    },
    async invoiceContext(tenantId: string, userId: string, competenceId: string) {
      const context = await dependencies.repository.getEmployeeCompetence(tenantId, userId, competenceId); if (!context) throw new Error('Competência não encontrada.');
      if (context.status !== 'awaiting_invoice') throw new InvalidFinanceError('Esta competência não está aguardando Nota Fiscal.'); return context;
    },
    async linkInvoice(command: { tenantId: string; userId: string; competenceId: string; documentId: string }) {
      const context = await this.invoiceContext(command.tenantId, command.userId, command.competenceId);
      if (!await dependencies.repository.documentMatches(command.tenantId, command.documentId, context.employeeId, 'invoice')) throw new InvalidFinanceError('A Nota Fiscal não pertence a esta competência.');
      const linked = await dependencies.repository.linkInvoice(command.tenantId, command.userId, command.competenceId, command.documentId, dependencies.generateId(), dependencies.generateId(), dependencies.now());
      if (!linked) throw new InvalidFinanceError('A competência deixou de aguardar Nota Fiscal.'); return true;
    },
    async recordPayment(command: { tenantId: string; managerUserId: string; competenceId: string; receiptDocumentId: string; notes?: string | null; paidDate?: string | null }) {
      const data = await dependencies.repository.getForecastData(command.tenantId, command.competenceId); if (!data) throw new Error('Competência não encontrada.');
      if (!await dependencies.repository.documentMatches(command.tenantId, command.receiptDocumentId, data.employeeId, 'payment_receipt')) throw new InvalidFinanceError('O comprovante não pertence ao funcionário ou possui tipo inválido.');
      if (command.paidDate && !/^\d{4}-\d{2}-\d{2}$/.test(command.paidDate)) throw new InvalidFinanceError('Informe uma data de pagamento válida.');
      const at = dependencies.now(); const paidAt = command.paidDate ? new Date(`${command.paidDate}T12:00:00.000Z`) : at;
      const payment = await dependencies.repository.recordPayment(command.tenantId, command.managerUserId, command.competenceId, command.receiptDocumentId, command.notes?.trim() || null, paidAt, dependencies.generateId(), dependencies.generateId(), dependencies.generateId(), at);
      if (!payment) throw new InvalidFinanceError('A competência não está aguardando pagamento ou não pertence ao gestor.'); return payment;
    },
    getPayment(tenantId: string, competenceId: string) { return dependencies.repository.getPayment(tenantId, competenceId); },
  };
}
