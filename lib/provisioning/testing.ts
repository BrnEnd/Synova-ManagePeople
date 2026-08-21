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
    const existing = this.userRequests.get(input.idempotencyKey);
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

    this.userRequests.set(input.idempotencyKey, {
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
    const requestKey = `reset:${input.idempotencyKey}`;
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
}
