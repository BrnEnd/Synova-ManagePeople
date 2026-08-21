import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tenantStatus = pgEnum('tenant_status', ['active', 'inactive']);
export const userRole = pgEnum('user_role', ['manager', 'employee']);
export const userStatus = pgEnum('user_status', ['active', 'inactive']);
export const employeeStatus = pgEnum('employee_status', ['pre_registration', 'active', 'inactive']);
export const documentType = pgEnum('document_type', [
  'identification',
  'address_proof',
  'contract',
  'payment_forecast',
  'invoice',
  'payment_receipt',
  'other',
]);
export const documentOrigin = pgEnum('document_origin', ['manager', 'employee', 'integration', 'generated']);
export const clientStatus = pgEnum('client_status', ['active', 'inactive']);
export const contractStatus = pgEnum('contract_status', ['active', 'ended']);
export const allocationStatus = pgEnum('allocation_status', ['active', 'ended']);
export const competenceStatus = pgEnum('competence_status', [
  'filling',
  'awaiting_approval',
  'adjustments_requested',
  'awaiting_invoice',
  'awaiting_payment',
  'paid',
]);

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  status: tenantStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [uniqueIndex('tenants_slug_unique').on(table.slug)]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  role: userRole('role').notNull(),
  status: userStatus('status').notNull().default('active'),
  passwordSalt: text('password_salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('users_tenant_email_unique').on(table.tenantId, table.email),
  uniqueIndex('users_tenant_id_id_unique').on(table.tenantId, table.id),
  index('users_tenant_role_idx').on(table.tenantId, table.role),
]);

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id'),
  fullName: text('full_name').notNull(),
  email: text('email'),
  corporateEmail: text('corporate_email'),
  phone: text('phone'),
  document: text('document'),
  address: jsonb('address').$type<{
    street: string;
    number?: string;
    complement?: string;
    district?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>(),
  entryDate: date('entry_date', { mode: 'string' }),
  professionalTitle: text('professional_title'),
  employmentType: text('employment_type').notNull().default('pj'),
  status: employeeStatus('status').notNull().default('pre_registration'),
  onboardingPending: boolean('onboarding_pending').notNull().default(true),
  missingFields: jsonb('missing_fields').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  inactivatedAt: timestamp('inactivated_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('employees_tenant_user_unique').on(table.tenantId, table.userId),
  uniqueIndex('employees_tenant_id_id_unique').on(table.tenantId, table.id),
  foreignKey({
    columns: [table.tenantId, table.userId],
    foreignColumns: [users.tenantId, users.id],
    name: 'employees_tenant_user_fk',
  }),
  index('employees_tenant_status_idx').on(table.tenantId, table.status),
  index('employees_tenant_name_idx').on(table.tenantId, table.fullName),
]);

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  type: documentType('type').notNull(),
  origin: documentOrigin('origin').notNull(),
  originalName: text('original_name').notNull(),
  pathname: text('pathname').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  uploadedByUserId: uuid('uploaded_by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('documents_pathname_unique').on(table.pathname),
  uniqueIndex('documents_tenant_id_id_unique').on(table.tenantId, table.id),
  index('documents_tenant_employee_created_idx').on(table.tenantId, table.employeeId, table.createdAt),
  foreignKey({
    columns: [table.tenantId, table.employeeId],
    foreignColumns: [employees.tenantId, employees.id],
    name: 'documents_tenant_employee_fk',
  }),
  foreignKey({
    columns: [table.tenantId, table.uploadedByUserId],
    foreignColumns: [users.tenantId, users.id],
    name: 'documents_tenant_uploader_fk',
  }),
]);

export const employeeNotes = pgTable('employee_notes', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  authorUserId: uuid('author_user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('employee_notes_tenant_employee_created_idx').on(table.tenantId, table.employeeId, table.createdAt),
  foreignKey({
    columns: [table.tenantId, table.employeeId],
    foreignColumns: [employees.tenantId, employees.id],
    name: 'employee_notes_tenant_employee_fk',
  }),
  foreignKey({
    columns: [table.tenantId, table.authorUserId],
    foreignColumns: [users.tenantId, users.id],
    name: 'employee_notes_tenant_author_fk',
  }),
]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  legalName: text('legal_name'),
  taxId: text('tax_id'),
  contactName: text('contact_name'),
  email: text('email'),
  phone: text('phone'),
  address: jsonb('address').$type<{
    street: string;
    number?: string;
    complement?: string;
    district?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>(),
  observations: text('observations'),
  status: clientStatus('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  inactivatedAt: timestamp('inactivated_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('clients_tenant_tax_id_unique').on(table.tenantId, table.taxId),
  uniqueIndex('clients_tenant_id_id_unique').on(table.tenantId, table.id),
  index('clients_tenant_status_name_idx').on(table.tenantId, table.status, table.name),
]);

export const contracts = pgTable('contracts', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  documentId: uuid('document_id'),
  contractType: text('contract_type').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  status: contractStatus('status').notNull().default('active'),
  observations: text('observations'),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('contracts_tenant_id_id_unique').on(table.tenantId, table.id),
  index('contracts_tenant_employee_start_idx').on(table.tenantId, table.employeeId, table.startDate),
  foreignKey({
    columns: [table.tenantId, table.employeeId],
    foreignColumns: [employees.tenantId, employees.id],
    name: 'contracts_tenant_employee_fk',
  }),
  foreignKey({
    columns: [table.tenantId, table.documentId],
    foreignColumns: [documents.tenantId, documents.id],
    name: 'contracts_tenant_document_fk',
  }),
  foreignKey({
    columns: [table.tenantId, table.createdByUserId],
    foreignColumns: [users.tenantId, users.id],
    name: 'contracts_tenant_creator_fk',
  }),
  check('contracts_valid_period_check', sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`),
]);

export const allocations = pgTable('allocations', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  clientId: uuid('client_id').notNull(),
  managerUserId: uuid('manager_user_id').notNull(),
  roleTitle: text('role_title'),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  status: allocationStatus('status').notNull().default('active'),
  observations: text('observations'),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('allocations_tenant_id_id_unique').on(table.tenantId, table.id),
  index('allocations_tenant_employee_start_idx').on(table.tenantId, table.employeeId, table.startDate),
  index('allocations_tenant_client_status_idx').on(table.tenantId, table.clientId, table.status),
  foreignKey({ columns: [table.tenantId, table.employeeId], foreignColumns: [employees.tenantId, employees.id], name: 'allocations_tenant_employee_fk' }),
  foreignKey({ columns: [table.tenantId, table.clientId], foreignColumns: [clients.tenantId, clients.id], name: 'allocations_tenant_client_fk' }),
  foreignKey({ columns: [table.tenantId, table.managerUserId], foreignColumns: [users.tenantId, users.id], name: 'allocations_tenant_manager_fk' }),
  foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [users.tenantId, users.id], name: 'allocations_tenant_creator_fk' }),
  check('allocations_valid_period_check', sql`${table.endDate} is null or ${table.endDate} >= ${table.startDate}`),
]);

export const financialConditions = pgTable('financial_conditions', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  hourlyRateCents: integer('hourly_rate_cents').notNull(),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  effectiveTo: date('effective_to', { mode: 'string' }),
  observations: text('observations'),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('financial_conditions_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('financial_conditions_version_unique').on(table.tenantId, table.employeeId, table.effectiveFrom),
  uniqueIndex('financial_conditions_open_unique').on(table.tenantId, table.employeeId).where(sql`${table.effectiveTo} is null`),
  index('financial_conditions_tenant_employee_effective_idx').on(table.tenantId, table.employeeId, table.effectiveFrom),
  foreignKey({ columns: [table.tenantId, table.employeeId], foreignColumns: [employees.tenantId, employees.id], name: 'financial_conditions_tenant_employee_fk' }),
  foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [users.tenantId, users.id], name: 'financial_conditions_tenant_creator_fk' }),
  check('financial_conditions_rate_positive_check', sql`${table.hourlyRateCents} > 0`),
  check('financial_conditions_valid_period_check', sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`),
]);

export const commercialConditions = pgTable('commercial_conditions', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  allocationId: uuid('allocation_id').notNull(),
  hourlyRateCents: integer('hourly_rate_cents').notNull(),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  effectiveTo: date('effective_to', { mode: 'string' }),
  observations: text('observations'),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('commercial_conditions_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('commercial_conditions_version_unique').on(table.tenantId, table.allocationId, table.effectiveFrom),
  uniqueIndex('commercial_conditions_open_unique').on(table.tenantId, table.allocationId).where(sql`${table.effectiveTo} is null`),
  index('commercial_conditions_tenant_allocation_effective_idx').on(table.tenantId, table.allocationId, table.effectiveFrom),
  foreignKey({ columns: [table.tenantId, table.allocationId], foreignColumns: [allocations.tenantId, allocations.id], name: 'commercial_conditions_tenant_allocation_fk' }),
  foreignKey({ columns: [table.tenantId, table.createdByUserId], foreignColumns: [users.tenantId, users.id], name: 'commercial_conditions_tenant_creator_fk' }),
  check('commercial_conditions_rate_positive_check', sql`${table.hourlyRateCents} > 0`),
  check('commercial_conditions_valid_period_check', sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`),
]);

export const competencies = pgTable('competencies', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  employeeId: uuid('employee_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  clientId: uuid('client_id').notNull(),
  managerUserId: uuid('manager_user_id').notNull(),
  referenceMonth: date('reference_month', { mode: 'string' }).notNull(),
  status: competenceStatus('status').notNull().default('filling'),
  totalMinutes: integer('total_minutes').notNull().default(0),
  revision: integer('revision').notNull().default(1),
  submittedAt: timestamp('submitted_at', { withTimezone: true, mode: 'date' }),
  approvedAt: timestamp('approved_at', { withTimezone: true, mode: 'date' }),
  approvedByUserId: uuid('approved_by_user_id'),
  approvedMinutes: integer('approved_minutes'),
  hourlyRateCents: integer('hourly_rate_cents'),
  approvedAmountCents: integer('approved_amount_cents'),
  adjustmentReason: text('adjustment_reason'),
  forecastDocumentId: uuid('forecast_document_id'),
  invoiceDocumentId: uuid('invoice_document_id'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('competencies_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('competencies_employee_month_unique').on(table.tenantId, table.employeeId, table.referenceMonth),
  index('competencies_tenant_status_month_idx').on(table.tenantId, table.status, table.referenceMonth),
  foreignKey({ columns: [table.tenantId, table.employeeId], foreignColumns: [employees.tenantId, employees.id], name: 'competencies_tenant_employee_fk' }),
  foreignKey({ columns: [table.tenantId, table.allocationId], foreignColumns: [allocations.tenantId, allocations.id], name: 'competencies_tenant_allocation_fk' }),
  foreignKey({ columns: [table.tenantId, table.clientId], foreignColumns: [clients.tenantId, clients.id], name: 'competencies_tenant_client_fk' }),
  foreignKey({ columns: [table.tenantId, table.managerUserId], foreignColumns: [users.tenantId, users.id], name: 'competencies_tenant_manager_fk' }),
  foreignKey({ columns: [table.tenantId, table.approvedByUserId], foreignColumns: [users.tenantId, users.id], name: 'competencies_tenant_approver_fk' }),
  foreignKey({ columns: [table.tenantId, table.forecastDocumentId], foreignColumns: [documents.tenantId, documents.id], name: 'competencies_tenant_forecast_document_fk' }),
  foreignKey({ columns: [table.tenantId, table.invoiceDocumentId], foreignColumns: [documents.tenantId, documents.id], name: 'competencies_tenant_invoice_document_fk' }),
  check('competencies_month_first_day_check', sql`extract(day from ${table.referenceMonth}) = 1`),
  check('competencies_total_nonnegative_check', sql`${table.totalMinutes} >= 0`),
]);

export const competenceEvents = pgTable('competence_events', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  competenceId: uuid('competence_id').notNull(),
  actorUserId: uuid('actor_user_id'),
  eventType: text('event_type').notNull(),
  fromStatus: competenceStatus('from_status').notNull(),
  toStatus: competenceStatus('to_status').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('competence_events_tenant_competence_occurred_idx').on(table.tenantId, table.competenceId, table.occurredAt),
  foreignKey({ columns: [table.tenantId, table.competenceId], foreignColumns: [competencies.tenantId, competencies.id], name: 'competence_events_tenant_competence_fk' }),
  foreignKey({ columns: [table.tenantId, table.actorUserId], foreignColumns: [users.tenantId, users.id], name: 'competence_events_tenant_actor_fk' }),
]);

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  recipientUserId: uuid('recipient_user_id').notNull(),
  competenceId: uuid('competence_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  deduplicationKey: text('deduplication_key').notNull(),
  readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('notifications_tenant_deduplication_unique').on(table.tenantId, table.deduplicationKey),
  index('notifications_tenant_recipient_created_idx').on(table.tenantId, table.recipientUserId, table.createdAt),
  foreignKey({ columns: [table.tenantId, table.recipientUserId], foreignColumns: [users.tenantId, users.id], name: 'notifications_tenant_recipient_fk' }),
  foreignKey({ columns: [table.tenantId, table.competenceId], foreignColumns: [competencies.tenantId, competencies.id], name: 'notifications_tenant_competence_fk' }),
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  competenceId: uuid('competence_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  amountCents: integer('amount_cents').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }).notNull(),
  notes: text('notes'),
  receiptDocumentId: uuid('receipt_document_id').notNull(),
  recordedByUserId: uuid('recorded_by_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('payments_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('payments_competence_unique').on(table.tenantId, table.competenceId),
  index('payments_tenant_paid_at_idx').on(table.tenantId, table.paidAt),
  foreignKey({ columns: [table.tenantId, table.competenceId], foreignColumns: [competencies.tenantId, competencies.id], name: 'payments_tenant_competence_fk' }),
  foreignKey({ columns: [table.tenantId, table.employeeId], foreignColumns: [employees.tenantId, employees.id], name: 'payments_tenant_employee_fk' }),
  foreignKey({ columns: [table.tenantId, table.receiptDocumentId], foreignColumns: [documents.tenantId, documents.id], name: 'payments_tenant_receipt_document_fk' }),
  foreignKey({ columns: [table.tenantId, table.recordedByUserId], foreignColumns: [users.tenantId, users.id], name: 'payments_tenant_recorder_fk' }),
  check('payments_amount_positive_check', sql`${table.amountCents} > 0`),
]);

export const timeEntries = pgTable('time_entries', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  competenceId: uuid('competence_id').notNull(),
  employeeId: uuid('employee_id').notNull(),
  allocationId: uuid('allocation_id').notNull(),
  workDate: date('work_date', { mode: 'string' }).notNull(),
  minutes: integer('minutes').notNull(),
  observation: text('observation'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('time_entries_tenant_id_id_unique').on(table.tenantId, table.id),
  uniqueIndex('time_entries_competence_date_unique').on(table.tenantId, table.competenceId, table.workDate),
  index('time_entries_tenant_employee_date_idx').on(table.tenantId, table.employeeId, table.workDate),
  foreignKey({ columns: [table.tenantId, table.competenceId], foreignColumns: [competencies.tenantId, competencies.id], name: 'time_entries_tenant_competence_fk' }),
  foreignKey({ columns: [table.tenantId, table.employeeId], foreignColumns: [employees.tenantId, employees.id], name: 'time_entries_tenant_employee_fk' }),
  foreignKey({ columns: [table.tenantId, table.allocationId], foreignColumns: [allocations.tenantId, allocations.id], name: 'time_entries_tenant_allocation_fk' }),
  check('time_entries_minutes_check', sql`${table.minutes} > 0 and ${table.minutes} <= 1440`),
]);

export const serviceKeys = pgTable('service_keys', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
}, (table) => [
  uniqueIndex('service_keys_hash_unique').on(table.keyHash),
  index('service_keys_tenant_created_idx').on(table.tenantId, table.createdAt),
]);

export const externalHiringRecords = pgTable('external_hiring_records', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  externalHiringId: text('external_hiring_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  employeeId: uuid('employee_id').notNull(),
  requestHash: text('request_hash').notNull(),
  missingFields: jsonb('missing_fields').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('external_hiring_tenant_external_unique').on(table.tenantId, table.externalHiringId),
  uniqueIndex('external_hiring_tenant_idempotency_unique').on(table.tenantId, table.idempotencyKey),
  index('external_hiring_tenant_created_idx').on(table.tenantId, table.createdAt),
  foreignKey({
    columns: [table.tenantId, table.employeeId],
    foreignColumns: [employees.tenantId, employees.id],
    name: 'external_hiring_tenant_employee_fk',
  }),
]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  actorUserId: uuid('actor_user_id'),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('audit_events_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
  index('audit_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),
  foreignKey({
    columns: [table.tenantId, table.actorUserId],
    foreignColumns: [users.tenantId, users.id],
    name: 'audit_events_tenant_actor_fk',
  }),
]);

export const idempotencyRecords = pgTable('idempotency_records', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  scope: text('scope').notNull(),
  key: text('key').notNull(),
  requestHash: text('request_hash').notNull(),
  resourceId: uuid('resource_id').notNull(),
  responseStatus: integer('response_status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('idempotency_scope_key_unique').on(table.scope, table.key),
  index('idempotency_tenant_created_idx').on(table.tenantId, table.createdAt),
]);

export const loginAttempts = pgTable('login_attempts', {
  key: text('key').primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  failures: integer('failures').notNull(),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true, mode: 'date' }).notNull(),
  blockedUntil: timestamp('blocked_until', { withTimezone: true, mode: 'date' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [index('login_attempts_tenant_updated_idx').on(table.tenantId, table.updatedAt)]);
