import { createHmac } from 'node:crypto';
import type { StoredPassword } from '@/lib/identity/password';
import { employeeAccessAvailability } from '@/lib/employee-access/policy';

export type AccessEmployee = {
  id: string;
  tenantId: string;
  userId: string | null;
  fullName: string;
  personalEmail: string | null;
  status: 'pre_registration' | 'active' | 'inactive';
  onboardingPending: boolean;
};

export type AccessUser = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: 'employee';
  status: 'active';
  mustChangePassword: true;
};

export type EmployeeAccessAccounts = {
  getEmployee(tenantId: string, employeeId: string): Promise<AccessEmployee | null>;
  createAccess(input: {
    tenantId: string;
    employeeId: string;
    actorUserId: string;
    user: AccessUser & { createdAt: Date };
    credentials: { passwordSalt: string; passwordHash: string };
    idempotencyKey: string;
    requestHash: string;
    createdAt: Date;
  }): Promise<{ user: AccessUser; replayed: boolean }>;
};

export type AccessNotification = {
  employeeName: string;
  username: string;
  temporaryPassword: string;
};

export class EmployeeAccessNotFoundError extends Error {
  constructor() {
    super('Funcionário não encontrado.');
    this.name = 'EmployeeAccessNotFoundError';
  }
}

export class EmployeeAccessIneligibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmployeeAccessIneligibleError';
  }
}

export class EmployeeAccessConflictError extends Error {
  constructor(message = 'Não foi possível criar o acesso porque o e-mail já está em uso.') {
    super(message);
    this.name = 'EmployeeAccessConflictError';
  }
}

export function assertEmployeeAccessAvailable(employee: AccessEmployee, options?: { allowCreated?: boolean }) {
  const availability = employeeAccessAvailability(employee);
  if (availability === 'created' && !options?.allowCreated) {
    throw new EmployeeAccessConflictError('Este funcionário já possui acesso ao portal.');
  }
  if (availability === 'inactive') {
    throw new EmployeeAccessIneligibleError('Apenas funcionários ativos podem receber acesso ao portal.');
  }
  if (availability === 'onboarding_pending') {
    throw new EmployeeAccessIneligibleError('Conclua o onboarding antes de criar o acesso ao portal.');
  }
  if (availability === 'missing_email') {
    throw new EmployeeAccessIneligibleError('Cadastre o e-mail pessoal antes de criar o acesso ao portal.');
  }
}

export function createEmployeeAccessModule(dependencies: {
  accounts: EmployeeAccessAccounts;
  notify: (input: AccessNotification) => Promise<void>;
  hashPassword: (password: string) => Promise<StoredPassword>;
  idempotencySecret: string;
  generateId: () => string;
  now: () => Date;
  onNotificationError?: (input: { employeeId: string; userId: string; error: unknown }) => void;
}) {
  return {
    async create(command: {
      tenantId: string;
      employeeId: string;
      actorUserId: string;
      temporaryPassword: string;
    }) {
      const employee = await dependencies.accounts.getEmployee(command.tenantId, command.employeeId);
      if (!employee) throw new EmployeeAccessNotFoundError();
      assertEmployeeAccessAvailable(employee, { allowCreated: true });

      const email = employee.personalEmail!.trim().toLowerCase();
      const createdAt = dependencies.now();
      const credentials = await dependencies.hashPassword(command.temporaryPassword);
      const idempotencyKey = `employee:${employee.id}:portal-access:v1`;
      const requestHash = createHmac('sha256', dependencies.idempotencySecret)
        .update(JSON.stringify({
          tenantId: command.tenantId,
          employeeId: employee.id,
          email,
          temporaryPassword: command.temporaryPassword,
        }))
        .digest('hex');

      const result = await dependencies.accounts.createAccess({
        tenantId: command.tenantId,
        employeeId: employee.id,
        actorUserId: command.actorUserId,
        user: {
          id: dependencies.generateId(),
          tenantId: command.tenantId,
          email,
          displayName: employee.fullName.trim(),
          role: 'employee',
          status: 'active',
          mustChangePassword: true,
          createdAt,
        },
        credentials: { passwordSalt: credentials.salt, passwordHash: credentials.hash },
        idempotencyKey,
        requestHash,
        createdAt,
      });

      let notificationStatus: 'sent' | 'failed' | 'skipped' = result.replayed ? 'skipped' : 'sent';
      if (!result.replayed) {
        try {
          await dependencies.notify({
            employeeName: employee.fullName,
            username: result.user.email,
            temporaryPassword: command.temporaryPassword,
          });
        } catch (error) {
          notificationStatus = 'failed';
          dependencies.onNotificationError?.({ employeeId: employee.id, userId: result.user.id, error });
        }
      }

      return {
        accessCreated: true as const,
        user: { id: result.user.id, email: result.user.email },
        notificationStatus,
      };
    },
  };
}
