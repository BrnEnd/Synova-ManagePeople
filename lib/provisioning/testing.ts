import type { ProvisioningRepository, Tenant } from '@/lib/provisioning/module';

type IdempotencyRecord = {
  requestHash: string;
  tenant: Tenant;
};

export class InMemoryProvisioningRepository implements ProvisioningRepository {
  private readonly tenantRequests = new Map<string, IdempotencyRecord>();
  private readonly tenants = new Map<string, Tenant>();
  private readonly userRequests = new Map<string, {
    requestHash: string;
    user: Parameters<ProvisioningRepository['createUserIdempotently']>[0]['user'];
  }>();
  private readonly employees = new Map<string, { tenantId: string; userId: string | null }>();
  private readonly associationRequests = new Map<string, {
    requestHash: string;
    association: Awaited<ReturnType<ProvisioningRepository['associateUserIdempotently']>>['association'];
  }>();
  private readonly serviceKeyRequests = new Map<string, {
    requestHash: string;
    serviceKey: Parameters<ProvisioningRepository['createServiceKeyIdempotently']>[0]['serviceKey'];
  }>();

  addEmployee(tenantId: string, employeeId: string) {
    this.employees.set(employeeId, { tenantId, userId: null });
  }

  async createTenantIdempotently(input: Parameters<ProvisioningRepository['createTenantIdempotently']>[0]) {
    const existing = this.tenantRequests.get(input.idempotencyKey);
    if (existing) {
      return {
        tenant: existing.tenant,
        replayed: true,
        requestHash: existing.requestHash,
      };
    }

    this.tenantRequests.set(input.idempotencyKey, {
      requestHash: input.requestHash,
      tenant: input.tenant,
    });
    this.tenants.set(input.tenant.id, input.tenant);

    return {
      tenant: input.tenant,
      replayed: false,
      requestHash: input.requestHash,
    };
  }

  async createUserIdempotently(input: Parameters<ProvisioningRepository['createUserIdempotently']>[0]) {
    const requestKey = `${input.user.tenantId}:create:${input.idempotencyKey}`;
    const existing = this.userRequests.get(requestKey);
    if (existing) {
      return {
        user: existing.user,
        replayed: true,
        requestHash: existing.requestHash,
      };
    }

    if (!this.tenants.has(input.user.tenantId)) {
      throw new Error('Tenant não encontrado.');
    }

    this.userRequests.set(requestKey, {
      requestHash: input.requestHash,
      user: input.user,
    });

    return {
      user: input.user,
      replayed: false,
      requestHash: input.requestHash,
    };
  }

  async resetPasswordIdempotently(input: Parameters<ProvisioningRepository['resetPasswordIdempotently']>[0]) {
    const requestKey = `${input.tenantId}:reset:${input.idempotencyKey}`;
    const existing = this.userRequests.get(requestKey);
    if (existing) {
      return { user: existing.user, replayed: true, requestHash: existing.requestHash };
    }
    const source = [...this.userRequests.values()].find(({ user }) => user.id === input.userId && user.tenantId === input.tenantId);
    if (!source) throw new Error('Usuário não encontrado.');
    const user = { ...source.user, mustChangePassword: true };
    this.userRequests.set(requestKey, { user, requestHash: input.requestHash });
    return { user, replayed: false, requestHash: input.requestHash };
  }

  async associateUserIdempotently(input: Parameters<ProvisioningRepository['associateUserIdempotently']>[0]) {
    const requestKey = `${input.tenantId}:${input.idempotencyKey}`;
    const existing = this.associationRequests.get(requestKey);
    if (existing) return { ...existing, replayed: true };
    const employee = this.employees.get(input.employeeId);
    const user = [...this.userRequests.values()].find(({ user: candidate }) => (
      candidate.id === input.userId
      && candidate.tenantId === input.tenantId
      && candidate.role === 'employee'
    ))?.user;
    if (!employee || employee.tenantId !== input.tenantId || !user) {
      throw new Error('Usuário ou funcionário não encontrado.');
    }
    if (employee.userId && employee.userId !== input.userId) throw new Error('Funcionário já associado.');
    employee.userId = input.userId;
    const association = {
      tenantId: input.tenantId,
      userId: input.userId,
      employeeId: input.employeeId,
      associatedAt: input.associatedAt,
    };
    this.associationRequests.set(requestKey, { requestHash: input.requestHash, association });
    return { association, replayed: false, requestHash: input.requestHash };
  }

  async createServiceKeyIdempotently(input: Parameters<ProvisioningRepository['createServiceKeyIdempotently']>[0]) {
    const requestKey = `${input.serviceKey.tenantId}:${input.idempotencyKey}`;
    const existing = this.serviceKeyRequests.get(requestKey);
    if (existing) return { ...existing, replayed: true };
    this.serviceKeyRequests.set(requestKey, {
      requestHash: input.requestHash,
      serviceKey: input.serviceKey,
    });
    return { serviceKey: input.serviceKey, replayed: false, requestHash: input.requestHash };
  }
}
