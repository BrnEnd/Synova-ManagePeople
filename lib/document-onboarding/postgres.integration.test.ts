import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, test } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const provisioningDatabaseUrl = process.env.TEST_PROVISIONING_DATABASE_URL;

describe.skipIf(!databaseUrl || !provisioningDatabaseUrl)('onboarding documental no PostgreSQL', () => {
  test('isola o tenant e exige submissão antes da revisão individual', async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.PROVISIONING_DATABASE_URL = provisioningDatabaseUrl;

    const [
      { createProvisioningModule },
      { PostgresProvisioningRepository },
      { hashPassword },
      { createEmployeesModule },
      { PostgresEmployeeRepository },
      { createDocumentsModule },
      { PostgresDocumentRepository },
      { DocumentOnboardingService, DocumentOnboardingError },
      { createOnboardingToken },
      { onboardingChecklist },
    ] = await Promise.all([
      import('@/lib/provisioning/module'),
      import('@/lib/provisioning/postgres-repository'),
      import('@/lib/identity/password'),
      import('@/lib/employees/module'),
      import('@/lib/employees/postgres-repository'),
      import('@/lib/documents/module'),
      import('@/lib/documents/postgres-repository'),
      import('@/lib/document-onboarding/service'),
      import('@/lib/document-onboarding/token'),
      import('@/lib/document-onboarding/domain'),
    ]);

    const normal = postgres(databaseUrl!, { max: 1, prepare: false });
    const privileged = postgres(provisioningDatabaseUrl!, { max: 1, prepare: false });
    const tenantIds: string[] = [];

    try {
      const provisioning = createProvisioningModule({
        repository: new PostgresProvisioningRepository(), generateId: randomUUID,
        now: () => new Date('2026-09-27T12:00:00.000Z'), hashPassword,
        idempotencySecret: 'documentation-integration-secret',
      });
      const tenant = await provisioning.createTenant({ name: 'Tenant onboarding', slug: `onboarding-${randomUUID()}`, idempotencyKey: randomUUID() });
      tenantIds.push(tenant.tenant.id);
      const manager = await provisioning.createUser({
        tenantId: tenant.tenant.id, email: 'manager@onboarding.test', displayName: 'Gestora Onboarding',
        role: 'manager', temporaryPassword: 'Integration#2026!Inicial', idempotencyKey: randomUUID(),
      });
      const employees = createEmployeesModule({ repository: new PostgresEmployeeRepository(), generateId: randomUUID, now: () => new Date('2026-09-27T12:00:00.000Z') });
      const employee = await employees.create({ tenantId: tenant.tenant.id, actorUserId: manager.user.id, fullName: 'Pessoa Onboarding', email: 'pessoa@onboarding.test' });

      const requestId = randomUUID();
      const generated = createOnboardingToken(tenant.tenant.id, requestId);
      const expiresAt = new Date('2026-10-12T12:00:00.000Z');
      await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenant.tenant.id}, true)`;
        await transaction`
          insert into document_onboarding_requests
            (id, tenant_id, employee_id, employment_type, status, token_hash, expires_at, created_by_user_id)
          values
            (${requestId}, ${tenant.tenant.id}, ${employee.id}, 'pj', 'in_progress', ${generated.tokenHash}, ${expiresAt}, ${manager.user.id})
        `;
        for (const [position, item] of onboardingChecklist('pj').entries()) {
          await transaction`
            insert into document_onboarding_items
              (id, tenant_id, request_id, key, label, required, status, position)
            values
              (${randomUUID()}, ${tenant.tenant.id}, ${requestId}, ${item.key}, ${item.label}, ${item.required}, 'pending', ${position})
          `;
        }
        await transaction`
          update employees set employment_type = 'pj', documentation_mode = 'self_service', documentation_status = 'in_progress'
          where tenant_id = ${tenant.tenant.id} and id = ${employee.id}
        `;
      });

      const documents = createDocumentsModule({ repository: new PostgresDocumentRepository(), generateId: randomUUID, now: () => new Date('2026-09-27T12:05:00.000Z') });
      const onboarding = new DocumentOnboardingService();
      for (const [key, type] of [['cnpj_card', 'cnpj_card'], ['address_proof', 'address_proof']] as const) {
        const recorded = await documents.recordUpload({
          tenantId: tenant.tenant.id, employeeId: employee.id, actorUserId: null, type, origin: 'employee',
          originalName: `${key}.pdf`, pathname: `tenants/${tenant.tenant.id}/employees/${employee.id}/${randomUUID()}-${key}.pdf`,
          mimeType: 'application/pdf', size: 1024,
        });
        await onboarding.linkDocument(generated.token, key, recorded.document.id);
      }

      const beforeSubmission = await onboarding.getForManager(tenant.tenant.id, employee.id);
      const cnpj = beforeSubmission!.items.find((item) => item.key === 'cnpj_card')!;
      expect(cnpj).toMatchObject({ status: 'uploaded', reviewable: false });
      await expect(onboarding.review({ tenantId: tenant.tenant.id, employeeId: employee.id, itemId: cnpj.id, actorUserId: manager.user.id, decision: 'approve' }))
        .rejects.toBeInstanceOf(DocumentOnboardingError);

      await onboarding.submit(generated.token);
      const submitted = await onboarding.getForManager(tenant.tenant.id, employee.id);
      expect(submitted?.request.status).toBe('submitted');
      expect(submitted?.items.filter((item) => item.status === 'uploaded').every((item) => item.reviewable)).toBe(true);
      await Promise.all(submitted!.items.filter((candidate) => candidate.status === 'uploaded').map((item) => onboarding.review({
        tenantId: tenant.tenant.id,
        employeeId: employee.id,
        itemId: item.id,
        actorUserId: manager.user.id,
        decision: 'approve',
      })));

      await expect(onboarding.getForManager(tenant.tenant.id, employee.id)).resolves.toMatchObject({ request: { status: 'approved' } });
      await expect(onboarding.getForManager(randomUUID(), employee.id)).resolves.toBeNull();
      await expect(employees.get(tenant.tenant.id, employee.id)).resolves.toMatchObject({
        documentationStatus: 'approved',
        missingFields: expect.arrayContaining(['identificationDocument', 'phone']),
      });
      const managerNotifications = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenant.tenant.id}, true)`;
        return transaction<{ type: string }[]>`select type from notifications where recipient_user_id = ${manager.user.id}`;
      });
      expect(managerNotifications.map((notification) => notification.type)).toEqual(expect.arrayContaining(['documentation.submitted', 'documentation.approved']));
    } finally {
      for (const tenantId of tenantIds) {
        await normal.begin(async (transaction) => {
          await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
          for (const table of ['notifications', 'document_onboarding_files', 'document_onboarding_items', 'document_onboarding_requests', 'documents', 'employees']) {
            await transaction.unsafe(`delete from ${table} where tenant_id = $1`, [tenantId]);
          }
        });
        await privileged.begin(async (transaction) => {
          for (const table of ['idempotency_records', 'audit_events', 'users']) await transaction.unsafe(`delete from ${table} where tenant_id = $1`, [tenantId]);
          await transaction`delete from tenants where id = ${tenantId}`;
        });
      }
      await Promise.all([normal.end(), privileged.end()]);
    }
  }, 60_000);
});
