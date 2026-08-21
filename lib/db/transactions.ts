import { sql } from 'drizzle-orm';
import { getDb, getProvisioningDb } from '@/lib/db/client';

type Database = ReturnType<typeof getDb>;
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export function withTenantTransaction<T>(
  tenantId: string,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
) {
  return getDb().transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return operation(transaction);
  });
}

export function withProvisioningTransaction<T>(
  operation: (transaction: DatabaseTransaction) => Promise<T>,
) {
  return getProvisioningDb().transaction(operation);
}
