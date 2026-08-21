import { createHmac } from 'node:crypto';
import { employeeMissingFields, type Employee, type EmployeeProfile } from '@/lib/employees/module';

export type HiringRecord = {
  id: string;
  tenantId: string;
  externalHiringId: string;
  idempotencyKey: string;
  employeeId: string;
  requestHash: string;
  missingFields: string[];
  createdAt: Date;
};

type PersistenceInput = {
  employee: Employee;
  hiring: HiringRecord;
};

export type HiringRepository = {
  createIdempotently(input: PersistenceInput): Promise<{
    employee: Employee;
    hiring: HiringRecord;
    replayed: boolean;
    requestHash: string;
  }>;
};

type Dependencies = {
  repository: HiringRepository;
  generateId: () => string;
  now: () => Date;
  idempotencySecret: string;
};

export class HiringConflictError extends Error {
  constructor() {
    super('A contratação externa ou a chave de idempotência já foi usada com outro conteúdo.');
    this.name = 'HiringConflictError';
  }
}

function optionalValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

export function createHiringIntegrationModule(dependencies: Dependencies) {
  return {
    async createPreRegistration(command: {
      tenantId: string;
      externalHiringId: string;
      idempotencyKey: string;
      fullName: string;
      email?: string;
      document?: string;
    }) {
      const fullName = command.fullName.trim();
      const email = optionalValue(command.email)?.toLowerCase() ?? null;
      const document = optionalValue(command.document);
      const request = {
        tenantId: command.tenantId,
        externalHiringId: command.externalHiringId.trim(),
        fullName,
        email,
        document,
      };
      const requestHash = createHmac('sha256', dependencies.idempotencySecret)
        .update(JSON.stringify(request)).digest('hex');
      const profile: EmployeeProfile = {
        fullName,
        personalEmail: email,
        corporateEmail: null,
        phone: null,
        identificationDocument: document,
        address: null,
        entryDate: null,
        professionalTitle: null,
        employmentType: 'pj',
      };
      const onboardingMissingFields = employeeMissingFields(profile, false);
      const missingFields = [
        ...onboardingMissingFields,
        'contract',
        'allocation',
        'financialCondition',
      ];
      const createdAt = dependencies.now();
      const employeeId = dependencies.generateId();
      const result = await dependencies.repository.createIdempotently({
        employee: {
          id: employeeId,
          tenantId: command.tenantId,
          userId: null,
          ...profile,
          status: 'pre_registration',
          onboardingPending: onboardingMissingFields.length > 0,
          missingFields: onboardingMissingFields,
          createdAt,
          inactivatedAt: null,
        },
        hiring: {
          id: dependencies.generateId(),
          tenantId: command.tenantId,
          externalHiringId: request.externalHiringId,
          idempotencyKey: command.idempotencyKey,
          employeeId,
          requestHash,
          missingFields,
          createdAt,
        },
      });
      if (result.requestHash !== requestHash) throw new HiringConflictError();
      return {
        employee: result.employee,
        externalHiringId: result.hiring.externalHiringId,
        missingFields: result.hiring.missingFields,
        replayed: result.replayed,
      };
    },
  };
}
