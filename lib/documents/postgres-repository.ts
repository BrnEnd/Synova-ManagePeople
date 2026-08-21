import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { auditEvents, documents, employees } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { DocumentRepository, EmployeeDocument } from '@/lib/documents/module';

function mapDocument(row: typeof documents.$inferSelect): EmployeeDocument {
  return row;
}

export class PostgresDocumentRepository implements DocumentRepository {
  async createIdempotently(document: EmployeeDocument) {
    return withTenantTransaction(document.tenantId, async (tx) => {
      const [employee] = await tx.select({ id: employees.id }).from(employees).where(and(
        eq(employees.tenantId, document.tenantId),
        eq(employees.id, document.employeeId),
      )).limit(1);
      if (!employee) throw new Error('Funcionário não encontrado.');

      const [created] = await tx.insert(documents).values(document).onConflictDoNothing({
        target: documents.pathname,
      }).returning();
      if (!created) {
        const [existing] = await tx.select().from(documents).where(and(
          eq(documents.tenantId, document.tenantId),
          eq(documents.pathname, document.pathname),
        )).limit(1);
        if (!existing) throw new Error('Documento já registrado em outro contexto.');
        return { document: mapDocument(existing), replayed: true };
      }

      if (created.type === 'identification') {
        const [current] = await tx.select({ missingFields: employees.missingFields }).from(employees).where(and(
          eq(employees.tenantId, document.tenantId),
          eq(employees.id, document.employeeId),
        )).limit(1);
        const missingFields = (current?.missingFields ?? []).filter((field) => field !== 'identificationDocumentFile');
        await tx.update(employees).set({
          missingFields,
          onboardingPending: missingFields.length > 0,
          updatedAt: document.createdAt,
        }).where(and(eq(employees.tenantId, document.tenantId), eq(employees.id, document.employeeId)));
      }

      await tx.insert(auditEvents).values({
        id: randomUUID(),
        tenantId: document.tenantId,
        actorUserId: document.uploadedByUserId,
        eventType: 'document.uploaded',
        entityType: 'employee',
        entityId: document.employeeId,
        metadata: { documentId: document.id, type: document.type, origin: document.origin },
        occurredAt: document.createdAt,
      });
      return { document: mapDocument(created), replayed: false };
    });
  }

  async listForEmployee(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => (await tx.select().from(documents).where(and(
      eq(documents.tenantId, tenantId),
      eq(documents.employeeId, employeeId),
      isNull(documents.archivedAt),
    )).orderBy(desc(documents.createdAt))).map(mapDocument));
  }

  async get(tenantId: string, documentId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [document] = await tx.select().from(documents).where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.id, documentId),
        isNull(documents.archivedAt),
      )).limit(1);
      return document ? mapDocument(document) : null;
    });
  }
}
