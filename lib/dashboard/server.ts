import 'server-only';
import { createDashboardModule } from '@/lib/dashboard/module';
import { PostgresDashboardRepository } from '@/lib/dashboard/postgres-repository';

let instance: ReturnType<typeof createDashboardModule> | undefined;
export function getDashboardModule() {
  instance ??= createDashboardModule({ repository: new PostgresDashboardRepository(), now: () => new Date() });
  return instance;
}
