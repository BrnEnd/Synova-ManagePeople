import 'server-only';
import { randomUUID } from 'node:crypto';
import { createWorkforceModule } from '@/lib/workforce/module';
import { PostgresWorkforceRepository } from '@/lib/workforce/postgres-repository';

let instance: ReturnType<typeof createWorkforceModule> | undefined;
export function getWorkforceModule() {
  instance ??= createWorkforceModule({ repository: new PostgresWorkforceRepository(), generateId: randomUUID, now: () => new Date() });
  return instance;
}
