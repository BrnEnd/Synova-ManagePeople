import { createHmac } from 'node:crypto';

export type TenantStatus = 'active' | 'inactive';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: Date;
};

export type UserRole = 'manager' | 'employee';
export type UserStatus = 'active' | 'inactive';

export type User = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
  createdAt: Date;
};

export type UserCredentials = {
  passwordSalt: string;
  passwordHash: string;
};

type CreateTenantCommand = {
  name: string;
  slug: string;
  idempotencyKey: string;
};

type CreateTenantPersistence = {
  tenant: Tenant;
  idempotencyKey: string;
  requestHash: string;
};

type CreateUserCommand = {
  tenantId: string;
  email: string;
  displayName: string;
  role: UserRole;
  temporaryPassword: string;
  idempotencyKey: string;
};

type CreateUserPersistence = {
  user: User;
  credentials: UserCredentials;
  idempotencyKey: string;
  requestHash: string;
};

type ResetPasswordCommand = {
  tenantId: string;
  userId: string;
  temporaryPassword: string;
  idempotencyKey: string;
};

type ResetPasswordPersistence = {
  tenantId: string;
  userId: string;
  credentials: UserCredentials;
  idempotencyKey: string;
  requestHash: string;
  changedAt: Date;
};

export type ProvisioningRepository = {
  createTenantIdempotently(input: CreateTenantPersistence): Promise<{
    tenant: Tenant;
    replayed: boolean;
    requestHash: string;
  }>;
  createUserIdempotently(input: CreateUserPersistence): Promise<{
    user: User;
    replayed: boolean;
    requestHash: string;
  }>;
  resetPasswordIdempotently(input: ResetPasswordPersistence): Promise<{
    user: User;
    replayed: boolean;
    requestHash: string;
  }>;
};

type ProvisioningDependencies = {
  repository: ProvisioningRepository;
  generateId: () => string;
  now: () => Date;
  hashPassword?: (password: string) => Promise<{ salt: string; hash: string }>;
  idempotencySecret: string;
};

export class IdempotencyConflictError extends Error {
  constructor() {
    super('A chave de idempotência já foi usada com outro conteúdo.');
    this.name = 'IdempotencyConflictError';
  }
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

function fingerprint(secret: string, value: unknown) {
  return createHmac('sha256', secret).update(JSON.stringify(value)).digest('hex');
}

function hashTenantRequest(secret: string, name: string, slug: string) {
  return fingerprint(secret, { name, slug });
}

function hashUserRequest(secret: string, input: Pick<CreateUserCommand, 'tenantId' | 'email' | 'displayName' | 'role' | 'temporaryPassword'>) {
  return fingerprint(secret, input);
}

function hashPasswordResetRequest(secret: string, tenantId: string, userId: string, temporaryPassword: string) {
  return fingerprint(secret, { tenantId, userId, temporaryPassword });
}

export function createProvisioningModule(dependencies: ProvisioningDependencies) {
  return {
    async createTenant(command: CreateTenantCommand) {
      const name = command.name.trim();
      const slug = normalizeSlug(command.slug);
      const requestHash = hashTenantRequest(dependencies.idempotencySecret, name, slug);
      const result = await dependencies.repository.createTenantIdempotently({
        tenant: {
          id: dependencies.generateId(),
          name,
          slug,
          status: 'active',
          createdAt: dependencies.now(),
        },
        idempotencyKey: command.idempotencyKey,
        requestHash,
      });

      if (result.requestHash !== requestHash) {
        throw new IdempotencyConflictError();
      }

      return { tenant: result.tenant, replayed: result.replayed };
    },

    async createUser(command: CreateUserCommand) {
      if (!dependencies.hashPassword) {
        throw new Error('A função de hash de senha não foi configurada.');
      }

      const email = command.email.trim().toLowerCase();
      const displayName = command.displayName.trim();
      const request = {
        tenantId: command.tenantId,
        email,
        displayName,
        role: command.role,
        temporaryPassword: command.temporaryPassword,
      };
      const password = await dependencies.hashPassword(command.temporaryPassword);
      const requestHash = hashUserRequest(dependencies.idempotencySecret, request);
      const result = await dependencies.repository.createUserIdempotently({
        user: {
          id: dependencies.generateId(),
          tenantId: request.tenantId,
          email: request.email,
          displayName: request.displayName,
          role: request.role,
          status: 'active',
          mustChangePassword: true,
          createdAt: dependencies.now(),
        },
        credentials: {
          passwordSalt: password.salt,
          passwordHash: password.hash,
        },
        idempotencyKey: command.idempotencyKey,
        requestHash,
      });

      if (result.requestHash !== requestHash) {
        throw new IdempotencyConflictError();
      }

      return { user: result.user, replayed: result.replayed };
    },

    async resetPassword(command: ResetPasswordCommand) {
      if (!dependencies.hashPassword) {
        throw new Error('A função de hash de senha não foi configurada.');
      }
      const password = await dependencies.hashPassword(command.temporaryPassword);
      const requestHash = hashPasswordResetRequest(
        dependencies.idempotencySecret,
        command.tenantId,
        command.userId,
        command.temporaryPassword,
      );
      const result = await dependencies.repository.resetPasswordIdempotently({
        tenantId: command.tenantId,
        userId: command.userId,
        credentials: { passwordSalt: password.salt, passwordHash: password.hash },
        idempotencyKey: command.idempotencyKey,
        requestHash,
        changedAt: dependencies.now(),
      });
      if (result.requestHash !== requestHash) throw new IdempotencyConflictError();
      return { user: result.user, replayed: result.replayed };
    },
  };
}
