import 'server-only';
import { randomUUID } from 'node:crypto';
import { createTimekeepingModule } from '@/lib/timekeeping/module';
import { PostgresTimekeepingRepository } from '@/lib/timekeeping/postgres-repository';
let instance: ReturnType<typeof createTimekeepingModule> | undefined;
export function getTimekeepingModule() {
  instance ??= createTimekeepingModule({ repository: new PostgresTimekeepingRepository(), generateId: randomUUID, now: () => new Date() });
  return instance;
}
