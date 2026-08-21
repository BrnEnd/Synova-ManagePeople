import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { describe, expect, test } from 'vitest';

const databaseUrl = process.env.TEST_DATABASE_URL;
const provisioningDatabaseUrl = process.env.TEST_PROVISIONING_DATABASE_URL;

describe.skipIf(!databaseUrl || !provisioningDatabaseUrl)('integração PostgreSQL', () => {
  test('persiste, audita e isola provisionamento e autenticação por tenant', async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.PROVISIONING_DATABASE_URL = provisioningDatabaseUrl;

    const [
      { createProvisioningModule },
      { PostgresProvisioningRepository },
      { createIdentityModule },
      { PostgresIdentityRepository },
      { hashPassword, verifyPassword },
      { createEmployeesModule },
      { PostgresEmployeeRepository },
      { createHiringIntegrationModule },
      { PostgresHiringRepository },
      { tenantForServiceKey },
      { createDocumentsModule },
      { PostgresDocumentRepository },
      { createClientsModule },
      { PostgresClientRepository },
    ] = await Promise.all([
      import('@/lib/provisioning/module'),
      import('@/lib/provisioning/postgres-repository'),
      import('@/lib/identity/module'),
      import('@/lib/identity/postgres-repository'),
      import('@/lib/identity/password'),
      import('@/lib/employees/module'),
      import('@/lib/employees/postgres-repository'),
      import('@/lib/integrations/hiring/module'),
      import('@/lib/integrations/hiring/postgres-repository'),
      import('@/lib/integrations/hiring/service-key-repository'),
      import('@/lib/documents/module'),
      import('@/lib/documents/postgres-repository'),
      import('@/lib/clients/module'),
      import('@/lib/clients/postgres-repository'),
    ]);

    const normal = postgres(databaseUrl!, { max: 1, prepare: false });
    const privileged = postgres(provisioningDatabaseUrl!, { max: 1, prepare: false });
    const tenantSlug = `integration-${randomUUID()}`;
    const temporaryPassword = 'Integration#2026!Inicial';
    const tenantIds: string[] = [];

    try {
      const provisioning = createProvisioningModule({
        repository: new PostgresProvisioningRepository(),
        generateId: randomUUID,
        now: () => new Date(),
        hashPassword,
        idempotencySecret: 'integration-idempotency-secret',
      });
      const tenantResult = await provisioning.createTenant({
        name: 'Tenant de integração',
        slug: tenantSlug,
        idempotencyKey: randomUUID(),
      });
      const tenantId = tenantResult.tenant.id;
      tenantIds.push(tenantId);
      const userResult = await provisioning.createUser({
        tenantId,
        email: 'manager@integration.test',
        displayName: 'Gestão de integração',
        role: 'manager',
        temporaryPassword,
        idempotencyKey: randomUUID(),
      });
      const employeeUserResult = await provisioning.createUser({
        tenantId,
        email: 'employee@integration.test',
        displayName: 'Funcionária de integração',
        role: 'employee',
        temporaryPassword,
        idempotencyKey: randomUUID(),
      });
      const otherTenant = await provisioning.createTenant({
        name: 'Outro tenant de integração',
        slug: `other-${randomUUID()}`,
        idempotencyKey: randomUUID(),
      });
      tenantIds.push(otherTenant.tenant.id);
      const otherTenantUser = await provisioning.createUser({
        tenantId: otherTenant.tenant.id,
        email: 'employee@other-integration.test',
        displayName: 'Funcionária de outro tenant',
        role: 'employee',
        temporaryPassword,
        idempotencyKey: randomUUID(),
      });

      const employeesModule = createEmployeesModule({
        repository: new PostgresEmployeeRepository(),
        generateId: randomUUID,
        now: () => new Date(),
      });
      const employee = await employeesModule.create({
        tenantId,
        actorUserId: userResult.user.id,
        fullName: 'Funcionária de integração',
        email: employeeUserResult.user.email,
      });
      await expect(provisioning.associateUser({
        tenantId,
        userId: employeeUserResult.user.id,
        employeeId: employee.id,
        idempotencyKey: randomUUID(),
      })).resolves.toMatchObject({
        association: { tenantId, userId: employeeUserResult.user.id, employeeId: employee.id },
        replayed: false,
      });

      const documentsModule = createDocumentsModule({
        repository: new PostgresDocumentRepository(),
        generateId: randomUUID,
        now: () => new Date(),
      });
      const employeeDocument = await documentsModule.recordUpload({
        tenantId,
        employeeId: employee.id,
        actorUserId: userResult.user.id,
        type: 'identification',
        origin: 'manager',
        originalName: 'identificacao.pdf',
        pathname: `tenants/${tenantId}/employees/${employee.id}/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        size: 1024,
      });
      expect(employeeDocument.replayed).toBe(false);
      await expect(employeesModule.update({
        tenantId,
        employeeId: employee.id,
        actorUserId: userResult.user.id,
        status: 'active',
        profile: {
          fullName: employee.fullName,
          personalEmail: employeeUserResult.user.email,
          corporateEmail: 'employee@synova.integration',
          phone: '+55 11 99999-9999',
          identificationDocument: '12345678900',
          address: {
            street: 'Rua da Integração', city: 'São Paulo', state: 'SP', postalCode: '01000-000', country: 'Brasil',
          },
          entryDate: '2026-08-01',
          professionalTitle: 'Consultora',
          employmentType: 'pj',
        },
      })).resolves.toMatchObject({ status: 'active', onboardingPending: false, missingFields: [] });
      await expect(employeesModule.addNote({
        tenantId,
        employeeId: employee.id,
        actorUserId: userResult.user.id,
        content: 'Anotação da integração',
      })).resolves.toMatchObject({ authorName: 'Gestão de integração' });

      const clientsModule = createClientsModule({
        repository: new PostgresClientRepository(), generateId: randomUUID, now: () => new Date(),
      });
      const client = await clientsModule.create({
        tenantId, actorUserId: userResult.user.id,
        profile: {
          name: 'Cliente de integração', legalName: 'Cliente de integração Ltda', taxId: '12345678000190',
          contactName: 'Contato', email: 'contato@cliente.integration', phone: null, address: null, observations: null,
        },
      });
      await expect(clientsModule.get(otherTenant.tenant.id, client.id)).resolves.toBeNull();

      const rawServiceKey = `service-key-${randomUUID()}-${randomUUID()}`;
      await provisioning.createServiceKey({
        tenantId,
        name: 'Portal de Vagas',
        serviceKey: rawServiceKey,
        idempotencyKey: randomUUID(),
      });
      await expect(tenantForServiceKey(rawServiceKey, 'integration-idempotency-secret')).resolves.toBe(tenantId);
      const hiringIntegration = createHiringIntegrationModule({
        repository: new PostgresHiringRepository(),
        generateId: randomUUID,
        now: () => new Date(),
        idempotencySecret: 'integration-idempotency-secret',
      });
      const externalCommand = {
        tenantId,
        externalHiringId: `hiring-${randomUUID()}`,
        idempotencyKey: randomUUID(),
        fullName: 'Contratação externa',
        email: 'external@integration.test',
      };
      const externalEmployee = await hiringIntegration.createPreRegistration(externalCommand);
      await expect(hiringIntegration.createPreRegistration(externalCommand)).resolves.toMatchObject({
        employee: { id: externalEmployee.employee.id, tenantId },
        replayed: true,
      });

      await expect(normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
        await transaction`
          insert into employees (id, tenant_id, user_id, full_name)
          values (${randomUUID()}, ${tenantId}, ${otherTenantUser.user.id}, 'Vínculo cruzado')
        `;
      })).rejects.toThrow();

      const employeeVisibility = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
        const own = await transaction<{ count: string }[]>`select count(*)::text as count from employees`;
        await transaction`select set_config('app.tenant_id', ${otherTenant.tenant.id}, true)`;
        const other = await transaction<{ count: string }[]>`select count(*)::text as count from employees`;
        return { own: Number(own[0].count), other: Number(other[0].count) };
      });
      expect(employeeVisibility).toEqual({ own: 2, other: 0 });

      const documentVisibility = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
        const own = await transaction<{ count: string }[]>`select count(*)::text as count from documents`;
        await transaction`select set_config('app.tenant_id', ${otherTenant.tenant.id}, true)`;
        const other = await transaction<{ count: string }[]>`select count(*)::text as count from documents`;
        return { own: Number(own[0].count), other: Number(other[0].count) };
      });
      expect(documentVisibility).toEqual({ own: 1, other: 0 });

      const clientVisibility = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
        const own = await transaction<{ count: string }[]>`select count(*)::text as count from clients`;
        await transaction`select set_config('app.tenant_id', ${otherTenant.tenant.id}, true)`;
        const other = await transaction<{ count: string }[]>`select count(*)::text as count from clients`;
        return { own: Number(own[0].count), other: Number(other[0].count) };
      });
      expect(clientVisibility).toEqual({ own: 1, other: 0 });

      await expect(normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
        await transaction`
          insert into employee_notes (id, tenant_id, employee_id, author_user_id, content)
          values (${randomUUID()}, ${tenantId}, ${employee.id}, ${otherTenantUser.user.id}, 'Autor cruzado')
        `;
      })).rejects.toThrow();

      const [normalRole] = await normal<{
        current_user: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
        has_provisioner: boolean;
      }[]>`
        select current_user,
               roles.rolsuper,
               roles.rolbypassrls,
               pg_has_role(current_user, 'synova_provisioner', 'member') as has_provisioner
        from pg_roles as roles
        where roles.rolname = current_user
      `;
      const [provisioningRole] = await privileged<{
        current_user: string;
        rolsuper: boolean;
        rolbypassrls: boolean;
      }[]>`
        select current_user, roles.rolsuper, roles.rolbypassrls
        from pg_roles as roles
        where roles.rolname = current_user
      `;
      expect(normalRole).toMatchObject({
        rolsuper: false,
        rolbypassrls: false,
        has_provisioner: false,
      });
      expect(normalRole.current_user).not.toBe('synova_provisioner');
      expect(provisioningRole).toEqual({
        current_user: 'synova_provisioner',
        rolsuper: false,
        rolbypassrls: false,
      });

      const unscoped = await normal<{ count: string }[]>`select count(*)::text as count from users`;
      expect(Number(unscoped[0].count)).toBe(0);
      const legacyBypass = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.provisioning', 'on', true)`;
        const rows = await transaction<{ count: string }[]>`select count(*)::text as count from users`;
        return Number(rows[0].count);
      });
      expect(legacyBypass).toBe(0);

      const scopedUserCount = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId!}, true)`;
        const rows = await transaction<{ count: string }[]>`select count(*)::text as count from users`;
        return Number(rows[0].count);
      });
      expect(scopedUserCount).toBe(2);

      const identity = createIdentityModule({
        repository: new PostgresIdentityRepository(),
        verifyPassword,
        hashPassword,
        now: () => new Date(),
      });
      await expect(identity.authenticate({
        tenantSlug,
        email: userResult.user.email,
        password: 'Senha#2026!Incorreta',
        ip: '127.0.0.1',
      })).resolves.toEqual({ identity: null, rateLimited: false });

      const ownAttempts = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${tenantId!}, true)`;
        const rows = await transaction<{ count: string }[]>`select count(*)::text as count from login_attempts`;
        return Number(rows[0].count);
      });
      const otherAttempts = await normal.begin(async (transaction) => {
        await transaction`select set_config('app.tenant_id', ${randomUUID()}, true)`;
        const rows = await transaction<{ count: string }[]>`select count(*)::text as count from login_attempts`;
        return Number(rows[0].count);
      });
      expect(ownAttempts).toBe(1);
      expect(otherAttempts).toBe(0);

      await expect(identity.authenticate({
        tenantSlug,
        email: userResult.user.email,
        password: temporaryPassword,
        ip: '127.0.0.1',
      })).resolves.toMatchObject({
        identity: { id: userResult.user.id, tenantId, role: 'manager' },
        rateLimited: false,
      });

      const audit = await privileged<{ event_type: string }[]>`
        select event_type from audit_events where tenant_id = ${tenantId} order by occurred_at
      `;
      expect(audit.map((event) => event.event_type)).toEqual(expect.arrayContaining([
        'tenant.created',
        'user.created',
        'employee.created',
        'employee.user_associated',
        'document.uploaded',
        'employee.updated',
        'employee.note_added',
        'client.created',
        'service_key.created',
        'employee.external_pre_registered',
        'user.logged_in',
      ]));
    } finally {
      for (const tenantId of tenantIds) {
        await normal.begin(async (transaction) => {
          await transaction`select set_config('app.tenant_id', ${tenantId}, true)`;
          await transaction`delete from login_attempts where tenant_id = ${tenantId}`;
          await transaction`delete from employee_notes where tenant_id = ${tenantId}`;
          await transaction`delete from documents where tenant_id = ${tenantId}`;
          await transaction`delete from clients where tenant_id = ${tenantId}`;
          await transaction`delete from external_hiring_records where tenant_id = ${tenantId}`;
          await transaction`delete from employees where tenant_id = ${tenantId}`;
        });
        await privileged.begin(async (transaction) => {
          await transaction`delete from idempotency_records where tenant_id = ${tenantId}`;
          await transaction`delete from audit_events where tenant_id = ${tenantId}`;
          await transaction`delete from service_keys where tenant_id = ${tenantId}`;
          await transaction`delete from users where tenant_id = ${tenantId}`;
          await transaction`delete from tenants where id = ${tenantId}`;
        });
      }
      await Promise.all([normal.end(), privileged.end()]);
    }
  });
});
