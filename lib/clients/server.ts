import 'server-only';
import { randomUUID } from 'node:crypto';
import { createClientsModule } from '@/lib/clients/module';
import { PostgresClientRepository } from '@/lib/clients/postgres-repository';

export function getClientsModule() {
  return createClientsModule({ repository: new PostgresClientRepository(), generateId: randomUUID, now: () => new Date() });
}
