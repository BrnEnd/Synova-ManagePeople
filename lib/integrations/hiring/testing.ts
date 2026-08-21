import type { HiringRecord, HiringRepository } from '@/lib/integrations/hiring/module';
import type { Employee } from '@/lib/employees/module';

type StoredResult = {
  employee: Employee;
  hiring: HiringRecord;
  requestHash: string;
};

export class InMemoryHiringRepository implements HiringRepository {
  private readonly byExternalId = new Map<string, StoredResult>();
  private readonly byIdempotencyKey = new Map<string, StoredResult>();

  async createIdempotently(input: Parameters<HiringRepository['createIdempotently']>[0]) {
    const externalKey = `${input.hiring.tenantId}:${input.hiring.externalHiringId}`;
    const idempotencyKey = `${input.hiring.tenantId}:${input.hiring.idempotencyKey}`;
    const existing = this.byExternalId.get(externalKey) ?? this.byIdempotencyKey.get(idempotencyKey);
    if (existing) return { ...existing, replayed: true };

    const stored = { employee: input.employee, hiring: input.hiring, requestHash: input.hiring.requestHash };
    this.byExternalId.set(externalKey, stored);
    this.byIdempotencyKey.set(idempotencyKey, stored);
    return { ...stored, replayed: false };
  }
}
