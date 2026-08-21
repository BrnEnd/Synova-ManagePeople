import 'server-only';
import { randomUUID } from 'node:crypto';
import { createHiringHttp } from '@/lib/integrations/hiring/http';
import { createHiringIntegrationModule } from '@/lib/integrations/hiring/module';
import { PostgresHiringRepository } from '@/lib/integrations/hiring/postgres-repository';
import { tenantForServiceKey } from '@/lib/integrations/hiring/service-key-repository';

export function getHiringHttp() {
  const idempotencySecret = process.env.PROVISIONING_IDEMPOTENCY_SECRET;
  if (!idempotencySecret) throw new Error('PROVISIONING_IDEMPOTENCY_SECRET não configurado.');
  return createHiringHttp({
    authenticate: (serviceKey) => tenantForServiceKey(serviceKey, idempotencySecret),
    integration: createHiringIntegrationModule({
      repository: new PostgresHiringRepository(),
      generateId: randomUUID,
      now: () => new Date(),
      idempotencySecret,
    }),
  });
}
