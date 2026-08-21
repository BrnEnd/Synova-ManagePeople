import type { DocumentRepository, EmployeeDocument } from '@/lib/documents/module';

export class InMemoryDocumentRepository implements DocumentRepository {
  readonly documents: EmployeeDocument[] = [];
  readonly employees = new Set<string>();

  addEmployee(tenantId: string, employeeId: string) {
    this.employees.add(`${tenantId}:${employeeId}`);
  }

  async createIdempotently(document: EmployeeDocument) {
    if (!this.employees.has(`${document.tenantId}:${document.employeeId}`)) {
      throw new Error('Funcionário não encontrado.');
    }
    const existing = this.documents.find((item) => item.pathname === document.pathname);
    if (existing) return { document: existing, replayed: true };
    this.documents.push(document);
    return { document, replayed: false };
  }

  async listForEmployee(tenantId: string, employeeId: string) {
    return this.documents.filter((document) => document.tenantId === tenantId && document.employeeId === employeeId);
  }

  async get(tenantId: string, documentId: string) {
    return this.documents.find((document) => document.tenantId === tenantId && document.id === documentId) ?? null;
  }
}
