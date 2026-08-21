import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDocumentsModule } from '@/lib/documents/server';
import { writeGeneratedDocument } from '@/lib/documents/storage';
import { createFinanceModule } from '@/lib/finance/module';
import { PostgresFinanceRepository } from '@/lib/finance/postgres-repository';
let instance: ReturnType<typeof createFinanceModule> | undefined;
export function getFinanceModule() { instance ??= createFinanceModule({ repository: new PostgresFinanceRepository(), documents: getDocumentsModule(), writeDocument: writeGeneratedDocument, generateId: randomUUID, now: () => new Date() }); return instance; }
