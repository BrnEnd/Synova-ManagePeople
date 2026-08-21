import 'server-only';
import { randomUUID } from 'node:crypto';
import { createApprovalsModule } from '@/lib/approvals/module';
import { PostgresApprovalRepository } from '@/lib/approvals/postgres-repository';
let instance: ReturnType<typeof createApprovalsModule> | undefined;
export function getApprovalsModule() { instance ??= createApprovalsModule({ repository: new PostgresApprovalRepository(), generateId: randomUUID, now: () => new Date() }); return instance; }
