export type CompetenceStatus = 'filling' | 'awaiting_approval' | 'adjustments_requested' | 'awaiting_invoice' | 'awaiting_payment' | 'paid';
export type TimeEntry = { id: string; tenantId: string; competenceId: string; employeeId: string; allocationId: string; workDate: string; minutes: number; observation: string | null; createdAt: Date; updatedAt: Date };
export type Competence = {
  id: string; tenantId: string; employeeId: string; allocationId: string; clientId: string; managerUserId: string;
  clientName: string; managerName: string; referenceMonth: string; status: CompetenceStatus; totalMinutes: number;
  revision: number; createdAt: Date; updatedAt: Date;
};
export type CompetenceDetail = { competence: Competence; entries: TimeEntry[] };

export type TimekeepingRepository = {
  openCompetence(tenantId: string, userId: string, referenceMonth: string, competenceId: string, at: Date): Promise<CompetenceDetail | null>;
  listCompetencies(tenantId: string, userId: string): Promise<Competence[]>;
  getOwnedCompetence(tenantId: string, userId: string, competenceId: string): Promise<CompetenceDetail | null>;
  saveEntry(entry: TimeEntry, userId: string): Promise<CompetenceDetail | null>;
  deleteEntry(tenantId: string, userId: string, competenceId: string, entryId: string, at: Date): Promise<CompetenceDetail | null>;
};

export class InvalidTimekeepingError extends Error {
  constructor(message: string) { super(message); this.name = 'InvalidTimekeepingError'; }
}
export class MissingAllocationError extends Error {
  constructor() { super('Não existe uma alocação válida para esta competência.'); this.name = 'MissingAllocationError'; }
}

function normalizeMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new InvalidTimekeepingError('Informe a competência no formato AAAA-MM.');
  return `${month}-01`;
}
function editable(status: CompetenceStatus) { return status === 'filling' || status === 'adjustments_requested'; }
function optional(value: string | null | undefined) { return value?.trim() || null; }

export function createTimekeepingModule(dependencies: { repository: TimekeepingRepository; generateId: () => string; now: () => Date }) {
  return {
    async open(command: { tenantId: string; userId: string; month: string }) {
      const detail = await dependencies.repository.openCompetence(command.tenantId, command.userId, normalizeMonth(command.month), dependencies.generateId(), dependencies.now());
      if (!detail) throw new MissingAllocationError();
      return detail;
    },
    list(tenantId: string, userId: string) { return dependencies.repository.listCompetencies(tenantId, userId); },
    async get(tenantId: string, userId: string, competenceId: string) {
      const detail = await dependencies.repository.getOwnedCompetence(tenantId, userId, competenceId);
      if (!detail) throw new Error('Competência não encontrada.');
      return detail;
    },
    async saveEntry(command: { tenantId: string; userId: string; competenceId: string; workDate: string; minutes: number; observation?: string | null }) {
      const detail = await dependencies.repository.getOwnedCompetence(command.tenantId, command.userId, command.competenceId);
      if (!detail) throw new Error('Competência não encontrada.');
      if (!editable(detail.competence.status)) throw new InvalidTimekeepingError('Esta competência não permite alterar lançamentos.');
      if (!Number.isInteger(command.minutes) || command.minutes <= 0 || command.minutes > 1440) throw new InvalidTimekeepingError('Informe entre 1 minuto e 24 horas.');
      if (command.workDate.slice(0, 7) !== detail.competence.referenceMonth.slice(0, 7)) throw new InvalidTimekeepingError('A data deve pertencer à competência selecionada.');
      const existing = detail.entries.find((entry) => entry.workDate === command.workDate);
      const now = dependencies.now();
      const saved = await dependencies.repository.saveEntry({
        id: existing?.id ?? dependencies.generateId(), tenantId: command.tenantId,
        competenceId: detail.competence.id, employeeId: detail.competence.employeeId,
        allocationId: detail.competence.allocationId, workDate: command.workDate, minutes: command.minutes,
        observation: optional(command.observation), createdAt: existing?.createdAt ?? now, updatedAt: now,
      }, command.userId);
      if (!saved) throw new InvalidTimekeepingError('A competência deixou de permitir alterações.');
      return saved;
    },
    async deleteEntry(command: { tenantId: string; userId: string; competenceId: string; entryId: string }) {
      const detail = await dependencies.repository.getOwnedCompetence(command.tenantId, command.userId, command.competenceId);
      if (!detail) throw new Error('Competência não encontrada.');
      if (!editable(detail.competence.status)) throw new InvalidTimekeepingError('Esta competência não permite alterar lançamentos.');
      const updated = await dependencies.repository.deleteEntry(command.tenantId, command.userId, command.competenceId, command.entryId, dependencies.now());
      if (!updated) throw new Error('Lançamento não encontrado.');
      return updated;
    },
  };
}
