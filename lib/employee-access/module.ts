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
  mustChangePassword: true;
  replayed: boolean;
};

export type EmployeeAccessAccounts = {
  getEmployee(tenantId: string, employeeId: string): Promise<AccessEmployee | null>;
  createUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    temporaryPassword: string;
    idempotencyKey: string;
  }): Promise<AccessUser>;
  associateUser(input: {
    tenantId: string;
    employeeId: string;
    userId: string;
    actorUserId: string;
  }): Promise<void>;
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

export function createEmployeeAccessModule(dependencies: {
  accounts: EmployeeAccessAccounts;
  notify: (input: AccessNotification) => Promise<void>;
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
      if (employee.userId) throw new EmployeeAccessConflictError('Este funcionário já possui acesso ao portal.');
      if (employee.status !== 'active') {
        throw new EmployeeAccessIneligibleError('Apenas funcionários ativos podem receber acesso ao portal.');
      }
      if (employee.onboardingPending) {
        throw new EmployeeAccessIneligibleError('Conclua o onboarding antes de criar o acesso ao portal.');
      }
      if (!employee.personalEmail) {
        throw new EmployeeAccessIneligibleError('Cadastre o e-mail pessoal antes de criar o acesso ao portal.');
      }

      const user = await dependencies.accounts.createUser({
        tenantId: command.tenantId,
        email: employee.personalEmail.trim().toLowerCase(),
        displayName: employee.fullName.trim(),
        temporaryPassword: command.temporaryPassword,
        idempotencyKey: `employee:${employee.id}:portal-access:user:v1`,
      });
      await dependencies.accounts.associateUser({
        tenantId: command.tenantId,
        employeeId: employee.id,
        userId: user.id,
        actorUserId: command.actorUserId,
      });

      let notificationStatus: 'sent' | 'failed' = 'sent';
      if (!user.replayed) {
        try {
          await dependencies.notify({
            employeeName: employee.fullName,
            username: user.email,
            temporaryPassword: command.temporaryPassword,
          });
        } catch (error) {
          notificationStatus = 'failed';
          dependencies.onNotificationError?.({ employeeId: employee.id, userId: user.id, error });
        }
      }

      return {
        accessCreated: true as const,
        user: { id: user.id, email: user.email },
        notificationStatus,
      };
    },
  };
}
