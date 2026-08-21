import 'server-only';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '@/lib/identity/password';
import { createProvisioningHttp } from '@/lib/provisioning/http';
import { createProvisioningModule } from '@/lib/provisioning/module';
import { PostgresProvisioningRepository } from '@/lib/provisioning/postgres-repository';

export function getProvisioningHttp() {
  const secret = process.env.PROVISIONING_SECRET;
  if (!secret) throw new Error('PROVISIONING_SECRET não configurado.');
  const idempotencySecret = process.env.PROVISIONING_IDEMPOTENCY_SECRET;
  if (!idempotencySecret) throw new Error('PROVISIONING_IDEMPOTENCY_SECRET não configurado.');

  return createProvisioningHttp({
    secret,
    provisioning: createProvisioningModule({
      repository: new PostgresProvisioningRepository(),
      generateId: randomUUID,
      now: () => new Date(),
      hashPassword,
      idempotencySecret,
    }),
  });
}
