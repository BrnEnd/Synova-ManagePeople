import 'server-only';
import { randomUUID } from 'node:crypto';
import { createDocumentsModule } from '@/lib/documents/module';
import { PostgresDocumentRepository } from '@/lib/documents/postgres-repository';

export function getDocumentsModule() {
  return createDocumentsModule({
    repository: new PostgresDocumentRepository(),
    generateId: randomUUID,
    now: () => new Date(),
  });
}
