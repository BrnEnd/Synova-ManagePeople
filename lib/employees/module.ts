export type EmployeeStatus = 'pre_registration' | 'active' | 'inactive';

export type Employee = {
  id: string;
  tenantId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  document: string | null;
  status: EmployeeStatus;
  onboardingPending: boolean;
  createdAt: Date;
  inactivatedAt: Date | null;
};

export type EmployeeRepository = {
  isUserLinkable(tenantId: string, userId: string, employeeId?: string): Promise<boolean>;
  create(employee: Employee, actorUserId: string): Promise<Employee>;
  list(tenantId: string): Promise<Employee[]>;
  inactivate(tenantId: string, employeeId: string, actorUserId: string, at: Date): Promise<Employee | null>;
  associateUser(
    tenantId: string,
    employeeId: string,
    userId: string,
    actorUserId: string,
    at: Date,
  ): Promise<Employee | null>;
};

export class InvalidEmployeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeError';
  }
}

type Dependencies = {
  repository: EmployeeRepository;
  generateId: () => string;
  now: () => Date;
};

function optionalValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

export function createEmployeesModule(dependencies: Dependencies) {
  return {
    async create(command: {
      tenantId: string;
      actorUserId: string;
      fullName: string;
      email?: string;
      document?: string;
      userId?: string;
    }) {
      const fullName = command.fullName.trim();
      if (fullName.length < 2) throw new InvalidEmployeeError('Informe o nome completo do funcionário.');
      if (command.userId && !await dependencies.repository.isUserLinkable(command.tenantId, command.userId)) {
        throw new InvalidEmployeeError('O usuário informado não está disponível neste tenant.');
      }

      const createdAt = dependencies.now();
      return dependencies.repository.create({
        id: dependencies.generateId(),
        tenantId: command.tenantId,
        userId: command.userId ?? null,
        fullName,
        email: optionalValue(command.email)?.toLowerCase() ?? null,
        document: optionalValue(command.document),
        status: 'pre_registration',
        onboardingPending: true,
        createdAt,
        inactivatedAt: null,
      }, command.actorUserId);
    },

    list(tenantId: string) {
      return dependencies.repository.list(tenantId);
    },

    async inactivate(command: { tenantId: string; employeeId: string; actorUserId: string }) {
      const employee = await dependencies.repository.inactivate(
        command.tenantId,
        command.employeeId,
        command.actorUserId,
        dependencies.now(),
      );
      if (!employee) throw new Error('Funcionário não encontrado.');
      return employee;
    },

    async associateUser(command: { tenantId: string; employeeId: string; userId: string; actorUserId: string }) {
      if (!await dependencies.repository.isUserLinkable(command.tenantId, command.userId, command.employeeId)) {
        throw new InvalidEmployeeError('O usuário informado não está disponível neste tenant.');
      }
      const employee = await dependencies.repository.associateUser(
        command.tenantId,
        command.employeeId,
        command.userId,
        command.actorUserId,
        dependencies.now(),
      );
      if (!employee) throw new Error('Funcionário não encontrado.');
      return employee;
    },
  };
}
