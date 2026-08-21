import type { EmployeeAddress } from '@/lib/employees/module';

export type ClientStatus = 'active' | 'inactive';

export type Client = {
  id: string;
  tenantId: string;
  name: string;
  legalName: string | null;
  taxId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: EmployeeAddress | null;
  observations: string | null;
  status: ClientStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
};

export type ClientProfile = Pick<Client,
  'name' | 'legalName' | 'taxId' | 'contactName' | 'email' | 'phone' | 'address' | 'observations'
>;

export type ClientRepository = {
  create(client: Client, actorUserId: string): Promise<Client>;
  list(tenantId: string): Promise<Client[]>;
  get(tenantId: string, clientId: string): Promise<Client | null>;
  update(tenantId: string, clientId: string, profile: ClientProfile, actorUserId: string, at: Date): Promise<Client | null>;
  inactivate(tenantId: string, clientId: string, actorUserId: string, at: Date): Promise<Client | null>;
};

export class InvalidClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidClientError';
  }
}

function optional(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizeAddress(address: EmployeeAddress | null): EmployeeAddress | null {
  if (!address) return null;
  return {
    street: address.street.trim(),
    number: optional(address.number) ?? undefined,
    complement: optional(address.complement) ?? undefined,
    district: optional(address.district) ?? undefined,
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim() || 'Brasil',
  };
}

function normalizeProfile(profile: ClientProfile): ClientProfile {
  const taxId = optional(profile.taxId)?.replace(/\D/g, '') ?? null;
  if (taxId && taxId.length !== 14) throw new InvalidClientError('Informe um CNPJ com 14 dígitos.');
  return {
    name: profile.name.trim(),
    legalName: optional(profile.legalName),
    taxId,
    contactName: optional(profile.contactName),
    email: optional(profile.email)?.toLowerCase() ?? null,
    phone: optional(profile.phone),
    address: normalizeAddress(profile.address),
    observations: optional(profile.observations),
  };
}

export function createClientsModule(dependencies: {
  repository: ClientRepository;
  generateId: () => string;
  now: () => Date;
}) {
  return {
    async create(command: { tenantId: string; actorUserId: string; profile: ClientProfile }) {
      const profile = normalizeProfile(command.profile);
      if (profile.name.length < 2) throw new InvalidClientError('Informe o nome do cliente.');
      const now = dependencies.now();
      return dependencies.repository.create({
        id: dependencies.generateId(), tenantId: command.tenantId, ...profile,
        status: 'active', createdAt: now, updatedAt: now, inactivatedAt: null,
      }, command.actorUserId);
    },
    list(tenantId: string) {
      return dependencies.repository.list(tenantId);
    },
    get(tenantId: string, clientId: string) {
      return dependencies.repository.get(tenantId, clientId);
    },
    async update(command: { tenantId: string; clientId: string; actorUserId: string; profile: ClientProfile }) {
      const profile = normalizeProfile(command.profile);
      if (profile.name.length < 2) throw new InvalidClientError('Informe o nome do cliente.');
      const client = await dependencies.repository.update(
        command.tenantId, command.clientId, profile, command.actorUserId, dependencies.now(),
      );
      if (!client) throw new Error('Cliente não encontrado.');
      return client;
    },
    async inactivate(command: { tenantId: string; clientId: string; actorUserId: string }) {
      const client = await dependencies.repository.inactivate(
        command.tenantId, command.clientId, command.actorUserId, dependencies.now(),
      );
      if (!client) throw new Error('Cliente não encontrado.');
      return client;
    },
  };
}
