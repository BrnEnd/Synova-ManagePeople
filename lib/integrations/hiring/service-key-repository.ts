import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { getProvisioningDb } from '@/lib/db/client';
import { serviceKeys, tenants } from '@/lib/db/schema';
import { serviceKeyHash } from '@/lib/integrations/service-key';

export async function tenantForServiceKey(value: string, secret: string) {
  const keyHash = serviceKeyHash(value, secret);
  const [credential] = await getProvisioningDb().select({ tenantId: serviceKeys.tenantId })
    .from(serviceKeys)
    .innerJoin(tenants, eq(tenants.id, serviceKeys.tenantId))
    .where(and(
      eq(serviceKeys.keyHash, keyHash),
      isNull(serviceKeys.revokedAt),
      eq(tenants.status, 'active'),
    )).limit(1);
  return credential?.tenantId ?? null;
}
