export type DatedStatus = 'active' | 'ended';

export type Contract = {
  id: string; tenantId: string; employeeId: string; documentId: string | null;
  contractType: string; startDate: string; endDate: string | null; status: DatedStatus;
  observations: string | null; createdByUserId: string; createdAt: Date; endedAt: Date | null;
};

export type Allocation = {
  id: string; tenantId: string; employeeId: string; clientId: string; clientName: string;
  managerUserId: string; managerName: string; roleTitle: string | null; startDate: string;
  endDate: string | null; status: DatedStatus; observations: string | null;
  createdByUserId: string; createdAt: Date; endedAt: Date | null;
};

export type RateCondition = {
  id: string; tenantId: string; hourlyRateCents: number; effectiveFrom: string;
  effectiveTo: string | null; observations: string | null; createdByUserId: string; createdAt: Date;
};

export type FinancialCondition = RateCondition & { employeeId: string };
export type CommercialCondition = RateCondition & { allocationId: string };

export type WorkforceDetail = {
  contracts: Contract[];
  allocations: Array<Allocation & { commercialConditions: CommercialCondition[] }>;
  financialConditions: FinancialCondition[];
  options: { clients: Array<{ id: string; name: string }>; managers: Array<{ id: string; name: string }> };
};

export type WorkforceRepository = {
  employeeExists(tenantId: string, employeeId: string): Promise<boolean>;
  documentBelongsToEmployee(tenantId: string, documentId: string, employeeId: string): Promise<boolean>;
  allocationExists(tenantId: string, allocationId: string): Promise<boolean>;
  createContract(contract: Contract, actorUserId: string): Promise<Contract>;
  listContracts(tenantId: string, employeeId: string): Promise<Contract[]>;
  endContract(tenantId: string, contractId: string, endDate: string, actorUserId: string, at: Date): Promise<Contract | null>;
  createAllocation(allocation: Omit<Allocation, 'clientName' | 'managerName'>, actorUserId: string): Promise<Allocation>;
  listAllocations(tenantId: string, employeeId: string): Promise<Allocation[]>;
  endAllocation(tenantId: string, allocationId: string, endDate: string, actorUserId: string, at: Date): Promise<Allocation | null>;
  listFinancialConditions(tenantId: string, employeeId: string): Promise<FinancialCondition[]>;
  addFinancialCondition(condition: FinancialCondition, previousId: string | null, previousEnd: string | null, actorUserId: string): Promise<FinancialCondition>;
  listCommercialConditions(tenantId: string, allocationId: string): Promise<CommercialCondition[]>;
  addCommercialCondition(condition: CommercialCondition, previousId: string | null, previousEnd: string | null, actorUserId: string): Promise<CommercialCondition>;
  listOptions(tenantId: string): Promise<WorkforceDetail['options']>;
};

export class InvalidWorkforceError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidWorkforceError'; }
}

function optional(value: string | null | undefined) { return value?.trim() || null; }

function previousDay(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function assertPeriod(startDate: string, endDate?: string | null) {
  if (endDate && endDate < startDate) throw new InvalidWorkforceError('A data final não pode anteceder a data inicial.');
}

function validateRate(hourlyRateCents: number) {
  if (!Number.isSafeInteger(hourlyRateCents) || hourlyRateCents <= 0) {
    throw new InvalidWorkforceError('Informe um valor-hora positivo em centavos.');
  }
}

export function createWorkforceModule(dependencies: { repository: WorkforceRepository; generateId: () => string; now: () => Date }) {
  const { repository } = dependencies;

  async function employeeRequired(tenantId: string, employeeId: string) {
    if (!await repository.employeeExists(tenantId, employeeId)) throw new Error('Funcionário não encontrado.');
  }

  return {
    async detail(tenantId: string, employeeId: string): Promise<WorkforceDetail | null> {
      if (!await repository.employeeExists(tenantId, employeeId)) return null;
      const [contracts, allocations, financialConditions, options] = await Promise.all([
        repository.listContracts(tenantId, employeeId), repository.listAllocations(tenantId, employeeId),
        repository.listFinancialConditions(tenantId, employeeId), repository.listOptions(tenantId),
      ]);
      const commercial = await Promise.all(allocations.map((allocation) => repository.listCommercialConditions(tenantId, allocation.id)));
      return { contracts, allocations: allocations.map((allocation, index) => ({ ...allocation, commercialConditions: commercial[index] })), financialConditions, options };
    },

    async createContract(command: { tenantId: string; employeeId: string; actorUserId: string; contractType: string; startDate: string; endDate?: string | null; documentId?: string | null; observations?: string | null }) {
      await employeeRequired(command.tenantId, command.employeeId);
      const contractType = command.contractType.trim();
      if (contractType.length < 2) throw new InvalidWorkforceError('Informe o tipo do contrato.');
      assertPeriod(command.startDate, command.endDate);
      const documentId = optional(command.documentId);
      if (documentId && !await repository.documentBelongsToEmployee(command.tenantId, documentId, command.employeeId)) {
        throw new InvalidWorkforceError('O documento informado não pertence ao funcionário.');
      }
      const now = dependencies.now();
      return repository.createContract({
        id: dependencies.generateId(), tenantId: command.tenantId, employeeId: command.employeeId,
        documentId, contractType, startDate: command.startDate, endDate: command.endDate ?? null,
        status: 'active', observations: optional(command.observations), createdByUserId: command.actorUserId,
        createdAt: now, endedAt: null,
      }, command.actorUserId);
    },

    async endContract(command: { tenantId: string; contractId: string; actorUserId: string; endDate: string }) {
      const ended = await repository.endContract(command.tenantId, command.contractId, command.endDate, command.actorUserId, dependencies.now());
      if (!ended) throw new Error('Contrato ativo não encontrado.');
      return ended;
    },

    async createAllocation(command: { tenantId: string; employeeId: string; actorUserId: string; clientId: string; managerUserId: string; roleTitle?: string | null; startDate: string; endDate?: string | null; observations?: string | null }) {
      await employeeRequired(command.tenantId, command.employeeId);
      assertPeriod(command.startDate, command.endDate);
      const now = dependencies.now();
      return repository.createAllocation({
        id: dependencies.generateId(), tenantId: command.tenantId, employeeId: command.employeeId,
        clientId: command.clientId, managerUserId: command.managerUserId, roleTitle: optional(command.roleTitle),
        startDate: command.startDate, endDate: command.endDate ?? null, status: 'active',
        observations: optional(command.observations), createdByUserId: command.actorUserId, createdAt: now, endedAt: null,
      }, command.actorUserId);
    },

    async endAllocation(command: { tenantId: string; allocationId: string; actorUserId: string; endDate: string }) {
      const ended = await repository.endAllocation(command.tenantId, command.allocationId, command.endDate, command.actorUserId, dependencies.now());
      if (!ended) throw new Error('Alocação ativa não encontrada.');
      return ended;
    },

    async addFinancialCondition(command: { tenantId: string; employeeId: string; actorUserId: string; hourlyRateCents: number; effectiveFrom: string; observations?: string | null }) {
      await employeeRequired(command.tenantId, command.employeeId);
      validateRate(command.hourlyRateCents);
      const existing = await repository.listFinancialConditions(command.tenantId, command.employeeId);
      const latest = existing[0] ?? null;
      if (latest && command.effectiveFrom <= latest.effectiveFrom) throw new InvalidWorkforceError('A nova vigência deve iniciar após a condição mais recente.');
      const condition: FinancialCondition = {
        id: dependencies.generateId(), tenantId: command.tenantId, employeeId: command.employeeId,
        hourlyRateCents: command.hourlyRateCents, effectiveFrom: command.effectiveFrom, effectiveTo: null,
        observations: optional(command.observations), createdByUserId: command.actorUserId, createdAt: dependencies.now(),
      };
      return repository.addFinancialCondition(condition, latest?.effectiveTo ? null : latest?.id ?? null, latest ? previousDay(command.effectiveFrom) : null, command.actorUserId);
    },

    async addCommercialCondition(command: { tenantId: string; allocationId: string; actorUserId: string; hourlyRateCents: number; effectiveFrom: string; observations?: string | null }) {
      if (!await repository.allocationExists(command.tenantId, command.allocationId)) throw new Error('Alocação não encontrada.');
      validateRate(command.hourlyRateCents);
      const existing = await repository.listCommercialConditions(command.tenantId, command.allocationId);
      const latest = existing[0] ?? null;
      if (latest && command.effectiveFrom <= latest.effectiveFrom) throw new InvalidWorkforceError('A nova vigência deve iniciar após a condição mais recente.');
      const condition: CommercialCondition = {
        id: dependencies.generateId(), tenantId: command.tenantId, allocationId: command.allocationId,
        hourlyRateCents: command.hourlyRateCents, effectiveFrom: command.effectiveFrom, effectiveTo: null,
        observations: optional(command.observations), createdByUserId: command.actorUserId, createdAt: dependencies.now(),
      };
      return repository.addCommercialCondition(condition, latest?.effectiveTo ? null : latest?.id ?? null, latest ? previousDay(command.effectiveFrom) : null, command.actorUserId);
    },
  };
}
