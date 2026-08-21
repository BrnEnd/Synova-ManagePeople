import type { Client, ClientProfile, ClientRepository } from '@/lib/clients/module';

export class InMemoryClientRepository implements ClientRepository {
  readonly clients: Client[] = [];
  readonly events: string[] = [];
  async create(client: Client) { this.clients.push(client); this.events.push('client.created'); return client; }
  async list(tenantId: string) { return this.clients.filter((client) => client.tenantId === tenantId); }
  async get(tenantId: string, clientId: string) { return this.clients.find((client) => client.tenantId === tenantId && client.id === clientId) ?? null; }
  async update(tenantId: string, clientId: string, profile: ClientProfile, _actor: string, at: Date) {
    const client = this.clients.find((item) => item.tenantId === tenantId && item.id === clientId && item.status === 'active');
    if (!client) return null;
    Object.assign(client, profile, { updatedAt: at }); this.events.push('client.updated'); return client;
  }
  async inactivate(tenantId: string, clientId: string, _actor: string, at: Date) {
    const client = this.clients.find((item) => item.tenantId === tenantId && item.id === clientId && item.status === 'active');
    if (!client) return null;
    Object.assign(client, { status: 'inactive' as const, inactivatedAt: at, updatedAt: at });
    this.events.push('client.inactivated'); return client;
  }
}
