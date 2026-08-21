import {
  boolean,
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

export const tenantStatus = pgEnum('tenant_status', ['active', 'inactive']);
export const userRole = pgEnum('user_role', ['manager', 'employee']);
export const userStatus = pgEnum('user_status', ['active', 'inactive']);
export const employeeStatus = pgEnum('employee_status', ['pre_registration', 'active', 'inactive']);

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
  document: text('document'),
  status: employeeStatus('status').notNull().default('pre_registration'),
  onboardingPending: boolean('onboarding_pending').notNull().default(true),
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
  actorUserId: uuid('actor_user_id').references(() => users.id),
  eventType: text('event_type').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => [
  index('audit_events_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
  index('audit_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),
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
