import 'server-only';
import { randomUUID } from 'node:crypto';
import { createEmployeesModule } from '@/lib/employees/module';
import { PostgresEmployeeRepository } from '@/lib/employees/postgres-repository';

export function getEmployeesModule() {
  return createEmployeesModule({
    repository: new PostgresEmployeeRepository(),
    generateId: randomUUID,
    now: () => new Date(),
  });
}
