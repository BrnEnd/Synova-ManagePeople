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
    ] = await Promise.all([
      import('@/lib/provisioning/module'),
      import('@/lib/provisioning/postgres-repository'),
      import('@/lib/identity/module'),
      import('@/lib/identity/postgres-repository'),
      import('@/lib/identity/password'),
    ]);

    const normal = postgres(databaseUrl!, { max: 1, prepare: false });
    const privileged = postgres(provisioningDatabaseUrl!, { max: 1, prepare: false });
    const tenantSlug = `integration-${randomUUID()}`;
    const temporaryPassword = 'Integration#2026!Inicial';
    let tenantId: string | undefined;

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
      tenantId = tenantResult.tenant.id;
      const userResult = await provisioning.createUser({
        tenantId,
        email: 'manager@integration.test',
        displayName: 'Gestão de integração',
        role: 'manager',
        temporaryPassword,
        idempotencyKey: randomUUID(),
      });

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
      expect(scopedUserCount).toBe(1);

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
      expect(audit.map((event) => event.event_type)).toEqual([
        'tenant.created',
        'user.created',
        'user.logged_in',
      ]);
    } finally {
      if (tenantId) {
        await normal.begin(async (transaction) => {
          await transaction`select set_config('app.tenant_id', ${tenantId!}, true)`;
          await transaction`delete from login_attempts where tenant_id = ${tenantId!}`;
        });
        await privileged.begin(async (transaction) => {
          await transaction`delete from idempotency_records where tenant_id = ${tenantId!}`;
          await transaction`delete from audit_events where tenant_id = ${tenantId!}`;
          await transaction`delete from users where tenant_id = ${tenantId!}`;
          await transaction`delete from tenants where id = ${tenantId!}`;
        });
      }
      await Promise.all([normal.end(), privileged.end()]);
    }
  });
});
