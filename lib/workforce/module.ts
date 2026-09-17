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
export type ApprovedWorkEntry = { allocationId: string; workDate: string; minutes: number; costAmountCents?: number; revenueAmountCents?: number; pricingComplete?: boolean };
export type AllocationPeriod = {
  allocationId: string; clientName: string; managerName: string; startDate: string; endDate: string | null;
  contractType: string | null; financialRateCents: number | null; commercialRateCents: number | null;
  approvedMinutes: number; totalPaidCents: number | null; totalReceivedCents: number | null;
};

export type AllocationUpdate = {
  tenantId: string; employeeId: string; allocationId: string; actorUserId: string;
  mode: 'replace' | 'stage' | 'end'; effectiveDate: string; previousEndDate: string;
  newAllocationId: string; contractId: string; financialConditionId: string; commercialConditionId: string;
  clientId?: string; managerUserId?: string; roleTitle?: string | null; endDate?: string | null; currentEndDate?: string;
  contractType?: string; financialRateCents?: number; commercialRateCents?: number; observations?: string | null;
};

export type WorkforceDetail = {
  contracts: Contract[];
  allocations: Array<Allocation & { commercialConditions: CommercialCondition[] }>;
  financialConditions: FinancialCondition[];
  current: AllocationPeriod | null;
  history: AllocationPeriod[];
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
  listApprovedEntries(tenantId: string, employeeId: string): Promise<ApprovedWorkEntry[]>;
  updateAllocation(command: AllocationUpdate): Promise<void>;
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

function activeOn<T extends { effectiveFrom: string; effectiveTo: string | null }>(items: T[], date: string) {
  return items.find((item) => item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date)) ?? null;
}

function buildHistory(input: { allocations: Array<Allocation & { commercialConditions: CommercialCondition[] }>; contracts: Contract[]; financial: FinancialCondition[]; entries: ApprovedWorkEntry[] }): AllocationPeriod[] {
  const periods: AllocationPeriod[] = [];
  for (const allocation of input.allocations) {
    const boundaries = new Set([allocation.startDate]);
    for (const date of [
      ...allocation.commercialConditions.map((item) => item.effectiveFrom),
      ...input.financial.map((item) => item.effectiveFrom),
      ...input.contracts.map((item) => item.startDate),
    ]) if (date >= allocation.startDate && (!allocation.endDate || date <= allocation.endDate)) boundaries.add(date);
    const starts = [...boundaries].sort();
    for (let index = 0; index < starts.length; index += 1) {
      const startDate = starts[index];
      const nextStart = starts[index + 1];
      const endDate = nextStart ? previousDay(nextStart) : allocation.endDate;
      const financial = activeOn(input.financial, startDate);
      const commercial = activeOn(allocation.commercialConditions, startDate);
      const contract = input.contracts.find((item) => item.startDate <= startDate && (!item.endDate || item.endDate >= startDate)) ?? null;
      const entries = input.entries.filter((entry) => entry.allocationId === allocation.id && entry.workDate >= startDate && (!endDate || entry.workDate <= endDate));
      const approvedMinutes = entries.reduce((total, entry) => total + entry.minutes, 0);
      periods.push({
        allocationId: allocation.id, clientName: allocation.clientName, managerName: allocation.managerName,
        startDate, endDate: endDate ?? null, contractType: contract?.contractType ?? null,
        financialRateCents: financial?.hourlyRateCents ?? null, commercialRateCents: commercial?.hourlyRateCents ?? null,
        approvedMinutes,
        totalPaidCents: entries.some((entry) => entry.pricingComplete === false) ? null : entries.length && entries.every((entry) => entry.costAmountCents !== undefined) ? entries.reduce((total, entry) => total + entry.costAmountCents!, 0) : financial ? Math.round(approvedMinutes * financial.hourlyRateCents / 60) : null,
        totalReceivedCents: entries.some((entry) => entry.pricingComplete === false) ? null : entries.length && entries.every((entry) => entry.revenueAmountCents !== undefined) ? entries.reduce((total, entry) => total + entry.revenueAmountCents!, 0) : commercial ? Math.round(approvedMinutes * commercial.hourlyRateCents / 60) : null,
      });
    }
  }
  return periods.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function createWorkforceModule(dependencies: { repository: WorkforceRepository; generateId: () => string; now: () => Date }) {
  const { repository } = dependencies;

  async function employeeRequired(tenantId: string, employeeId: string) {
    if (!await repository.employeeExists(tenantId, employeeId)) throw new Error('Funcionário não encontrado.');
  }

  return {
    async detail(tenantId: string, employeeId: string): Promise<WorkforceDetail | null> {
      if (!await repository.employeeExists(tenantId, employeeId)) return null;
      const [contracts, allocations, financialConditions, options, approvedEntries] = await Promise.all([
        repository.listContracts(tenantId, employeeId), repository.listAllocations(tenantId, employeeId),
        repository.listFinancialConditions(tenantId, employeeId), repository.listOptions(tenantId), repository.listApprovedEntries(tenantId, employeeId),
      ]);
      const commercial = await Promise.all(allocations.map((allocation) => repository.listCommercialConditions(tenantId, allocation.id)));
      const enriched = allocations.map((allocation, index) => ({ ...allocation, commercialConditions: commercial[index] }));
      const history = buildHistory({ allocations: enriched, contracts, financial: financialConditions, entries: approvedEntries });
      const activeAllocation = allocations.find((allocation) => allocation.status === 'active');
      return { contracts, allocations: enriched, financialConditions, options, history, current: history.find((period) => period.allocationId === activeAllocation?.id) ?? null };
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

    async updateAllocation(command: { tenantId: string; employeeId: string; allocationId: string; actorUserId: string; mode: 'replace' | 'stage' | 'end'; effectiveDate: string; currentEndDate?: string; clientId?: string; managerUserId?: string; roleTitle?: string | null; endDate?: string | null; contractType?: string; financialRateCents?: number; commercialRateCents?: number; observations?: string | null }) {
      await employeeRequired(command.tenantId, command.employeeId);
      const allocations = await repository.listAllocations(command.tenantId, command.employeeId);
      const active = allocations.find((allocation) => allocation.id === command.allocationId && allocation.status === 'active');
      if (!active) throw new InvalidWorkforceError('Alocação ativa não encontrada.');
      const [contracts, financial, commercial] = await Promise.all([
        repository.listContracts(command.tenantId, command.employeeId),
        repository.listFinancialConditions(command.tenantId, command.employeeId),
        repository.listCommercialConditions(command.tenantId, active.id),
      ]);
      const latestBoundary = [active.startDate, contracts[0]?.startDate, financial[0]?.effectiveFrom, commercial[0]?.effectiveFrom].filter((value): value is string => Boolean(value)).sort().at(-1)!;
      if (command.effectiveDate < latestBoundary || (command.mode !== 'end' && command.effectiveDate === latestBoundary)) throw new InvalidWorkforceError('A nova vigência deve iniciar após a etapa atual.');
      if (command.mode === 'replace') {
        if (!command.currentEndDate) throw new InvalidWorkforceError('Informe o término da alocação atual.');
        if (command.currentEndDate < latestBoundary || command.currentEndDate >= command.effectiveDate) throw new InvalidWorkforceError('O término atual deve respeitar a etapa vigente e anteceder o início da nova alocação.');
        if (!command.contractType?.trim()) throw new InvalidWorkforceError('Informe o tipo do contrato.');
        validateRate(command.financialRateCents ?? 0); validateRate(command.commercialRateCents ?? 0);
      } else if (command.mode === 'stage') {
        const hasChange = command.contractType !== undefined || command.financialRateCents !== undefined || command.commercialRateCents !== undefined || command.roleTitle !== undefined || command.endDate !== undefined;
        if (!hasChange) throw new InvalidWorkforceError('Informe ao menos uma alteração para a nova etapa.');
        if (command.contractType !== undefined && command.contractType.trim().length < 2) throw new InvalidWorkforceError('Informe o tipo do contrato.');
        if (command.financialRateCents !== undefined) validateRate(command.financialRateCents);
        if (command.commercialRateCents !== undefined) validateRate(command.commercialRateCents);
      }
      if (command.mode === 'replace' && (!command.clientId || !command.managerUserId)) throw new InvalidWorkforceError('Informe Cliente e Gestor da nova alocação.');
      assertPeriod(command.effectiveDate, command.endDate);
      return repository.updateAllocation({
        ...command, contractType: command.contractType?.trim(), roleTitle: command.roleTitle === undefined ? undefined : optional(command.roleTitle), observations: command.observations === undefined ? undefined : optional(command.observations),
        previousEndDate: command.mode === 'replace' ? command.currentEndDate! : command.mode === 'end' ? command.effectiveDate : previousDay(command.effectiveDate),
        newAllocationId: dependencies.generateId(), contractId: dependencies.generateId(), financialConditionId: dependencies.generateId(), commercialConditionId: dependencies.generateId(),
      });
    },
  };
}
