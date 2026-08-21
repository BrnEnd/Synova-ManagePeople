import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, isNull, ne } from 'drizzle-orm';
import { auditEvents, documents, employeeNotes, employees, users } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type {
  Employee,
  EmployeeHistoryEvent,
  EmployeeNote,
  EmployeeProfile,
  EmployeeRepository,
  EmployeeStatus,
} from '@/lib/employees/module';

function mapEmployee(row: typeof employees.$inferSelect): Employee {
  return {
    id: row.id,
    tenantId: row.tenantId,
    userId: row.userId,
    fullName: row.fullName,
    personalEmail: row.email,
    corporateEmail: row.corporateEmail,
    phone: row.phone,
    identificationDocument: row.document,
    address: row.address,
    entryDate: row.entryDate,
    professionalTitle: row.professionalTitle,
    employmentType: row.employmentType,
    status: row.status,
    onboardingPending: row.onboardingPending,
    missingFields: row.missingFields,
    createdAt: row.createdAt,
    inactivatedAt: row.inactivatedAt,
  };
}

export class PostgresEmployeeRepository implements EmployeeRepository {
  async isUserLinkable(tenantId: string, userId: string, employeeId?: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [user] = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.id, userId),
        eq(users.tenantId, tenantId),
        eq(users.role, 'employee'),
        eq(users.status, 'active'),
      )).limit(1);
      if (!user) return false;
      const conditions = [eq(employees.tenantId, tenantId), eq(employees.userId, userId)];
      if (employeeId) conditions.push(ne(employees.id, employeeId));
      const [linked] = await tx.select({ id: employees.id }).from(employees)
        .where(and(...conditions)).limit(1);
      return !linked;
    });
  }

  async hasIdentificationDocument(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [document] = await tx.select({ id: documents.id }).from(documents).where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.employeeId, employeeId),
        eq(documents.type, 'identification'),
        isNull(documents.archivedAt),
      )).limit(1);
      return Boolean(document);
    });
  }

  async create(employee: Employee, actorUserId: string) {
    return withTenantTransaction(employee.tenantId, async (tx) => {
      const [created] = await tx.insert(employees).values({
        id: employee.id,
        tenantId: employee.tenantId,
        userId: employee.userId,
        fullName: employee.fullName,
        email: employee.personalEmail,
        corporateEmail: employee.corporateEmail,
        phone: employee.phone,
        document: employee.identificationDocument,
        address: employee.address,
        entryDate: employee.entryDate,
        professionalTitle: employee.professionalTitle,
        employmentType: employee.employmentType,
        status: employee.status,
        onboardingPending: employee.onboardingPending,
        missingFields: employee.missingFields,
        createdAt: employee.createdAt,
        updatedAt: employee.createdAt,
        inactivatedAt: employee.inactivatedAt,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: employee.tenantId, actorUserId,
        eventType: 'employee.created', entityType: 'employee', entityId: created.id,
        metadata: { status: created.status, missingFields: created.missingFields }, occurredAt: employee.createdAt,
      });
      return mapEmployee(created);
    });
  }

  async list(tenantId: string) {
    return withTenantTransaction(tenantId, async (tx) => (await tx.select().from(employees)
      .where(eq(employees.tenantId, tenantId)).orderBy(asc(employees.fullName))).map(mapEmployee));
  }

  async get(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [employee] = await tx.select().from(employees).where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, employeeId),
      )).limit(1);
      return employee ? mapEmployee(employee) : null;
    });
  }

  async update(
    tenantId: string,
    employeeId: string,
    profile: EmployeeProfile,
    status: Exclude<EmployeeStatus, 'inactive'>,
    missingFields: string[],
    actorUserId: string,
    at: Date,
  ) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(employees).set({
        fullName: profile.fullName,
        email: profile.personalEmail,
        corporateEmail: profile.corporateEmail,
        phone: profile.phone,
        document: profile.identificationDocument,
        address: profile.address,
        entryDate: profile.entryDate,
        professionalTitle: profile.professionalTitle,
        employmentType: profile.employmentType,
        status,
        missingFields,
        onboardingPending: missingFields.length > 0,
        updatedAt: at,
      }).where(and(
        eq(employees.tenantId, tenantId),
        eq(employees.id, employeeId),
        ne(employees.status, 'inactive'),
      )).returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'employee.updated', entityType: 'employee', entityId: employeeId,
        metadata: { status, missingFields }, occurredAt: at,
      });
      return mapEmployee(updated);
    });
  }

  async addNote(note: Omit<EmployeeNote, 'authorName'>, actorUserId: string) {
    return withTenantTransaction(note.tenantId, async (tx) => {
      const [employee] = await tx.select({ id: employees.id }).from(employees).where(and(
        eq(employees.tenantId, note.tenantId),
        eq(employees.id, note.employeeId),
      )).limit(1);
      if (!employee) return null;
      const [created] = await tx.insert(employeeNotes).values({
        id: note.id,
        tenantId: note.tenantId,
        employeeId: note.employeeId,
        authorUserId: note.authorUserId,
        content: note.content,
        createdAt: note.createdAt,
      }).returning();
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId: note.tenantId, actorUserId,
        eventType: 'employee.note_added', entityType: 'employee', entityId: note.employeeId,
        metadata: { noteId: note.id }, occurredAt: note.createdAt,
      });
      const [author] = await tx.select({ displayName: users.displayName }).from(users).where(and(
        eq(users.id, note.authorUserId),
        eq(users.tenantId, note.tenantId),
      )).limit(1);
      return { ...created, authorName: author?.displayName ?? 'Usuário' };
    });
  }

  async listNotes(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const rows = await tx.select({
        id: employeeNotes.id,
        tenantId: employeeNotes.tenantId,
        employeeId: employeeNotes.employeeId,
        authorUserId: employeeNotes.authorUserId,
        authorName: users.displayName,
        content: employeeNotes.content,
        createdAt: employeeNotes.createdAt,
      }).from(employeeNotes).innerJoin(users, and(
        eq(users.id, employeeNotes.authorUserId),
        eq(users.tenantId, employeeNotes.tenantId),
      )).where(and(
        eq(employeeNotes.tenantId, tenantId),
        eq(employeeNotes.employeeId, employeeId),
      )).orderBy(desc(employeeNotes.createdAt));
      return rows;
    });
  }

  async listHistory(tenantId: string, employeeId: string) {
    return withTenantTransaction(tenantId, async (tx) => {
      const rows = await tx.select({
        id: auditEvents.id,
        eventType: auditEvents.eventType,
        actorName: users.displayName,
        metadata: auditEvents.metadata,
        occurredAt: auditEvents.occurredAt,
      }).from(auditEvents).leftJoin(users, and(
        eq(users.id, auditEvents.actorUserId),
        eq(users.tenantId, auditEvents.tenantId),
      )).where(and(
        eq(auditEvents.tenantId, tenantId),
        eq(auditEvents.entityType, 'employee'),
        eq(auditEvents.entityId, employeeId),
      )).orderBy(desc(auditEvents.occurredAt));
      return rows as EmployeeHistoryEvent[];
    });
  }

  async inactivate(tenantId: string, employeeId: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(employees).set({
        status: 'inactive', inactivatedAt: at, updatedAt: at,
      }).where(and(
        eq(employees.id, employeeId),
        eq(employees.tenantId, tenantId),
        ne(employees.status, 'inactive'),
      )).returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'employee.inactivated', entityType: 'employee', entityId: employeeId,
        occurredAt: at,
      });
      return mapEmployee(updated);
    });
  }

  async associateUser(tenantId: string, employeeId: string, userId: string, actorUserId: string, at: Date) {
    return withTenantTransaction(tenantId, async (tx) => {
      const [updated] = await tx.update(employees).set({ userId, updatedAt: at })
        .where(and(eq(employees.id, employeeId), eq(employees.tenantId, tenantId)))
        .returning();
      if (!updated) return null;
      await tx.insert(auditEvents).values({
        id: randomUUID(), tenantId, actorUserId,
        eventType: 'employee.user_associated', entityType: 'employee', entityId: employeeId,
        metadata: { userId }, occurredAt: at,
      });
      return mapEmployee(updated);
    });
  }
}
