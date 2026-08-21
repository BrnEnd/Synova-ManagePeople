export type EmployeeStatus = 'pre_registration' | 'active' | 'inactive';

export type EmployeeAddress = {
  street: string;
  number?: string;
  complement?: string;
  district?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type Employee = {
  id: string;
  tenantId: string;
  userId: string | null;
  fullName: string;
  personalEmail: string | null;
  corporateEmail: string | null;
  phone: string | null;
  identificationDocument: string | null;
  address: EmployeeAddress | null;
  entryDate: string | null;
  professionalTitle: string | null;
  employmentType: string;
  status: EmployeeStatus;
  onboardingPending: boolean;
  missingFields: string[];
  createdAt: Date;
  inactivatedAt: Date | null;
};

export type EmployeeNote = {
  id: string;
  tenantId: string;
  employeeId: string;
  authorUserId: string;
  authorName: string;
  content: string;
  createdAt: Date;
};

export type EmployeeHistoryEvent = {
  id: string;
  eventType: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  occurredAt: Date;
};

export type EmployeeProfile = Pick<Employee,
  | 'fullName'
  | 'personalEmail'
  | 'corporateEmail'
  | 'phone'
  | 'identificationDocument'
  | 'address'
  | 'entryDate'
  | 'professionalTitle'
  | 'employmentType'
>;

export type EmployeeRepository = {
  isUserLinkable(tenantId: string, userId: string, employeeId?: string): Promise<boolean>;
  hasIdentificationDocument(tenantId: string, employeeId: string): Promise<boolean>;
  create(employee: Employee, actorUserId: string): Promise<Employee>;
  list(tenantId: string): Promise<Employee[]>;
  get(tenantId: string, employeeId: string): Promise<Employee | null>;
  update(
    tenantId: string,
    employeeId: string,
    profile: EmployeeProfile,
    status: Exclude<EmployeeStatus, 'inactive'>,
    missingFields: string[],
    actorUserId: string,
    at: Date,
  ): Promise<Employee | null>;
  addNote(note: Omit<EmployeeNote, 'authorName'>, actorUserId: string): Promise<EmployeeNote | null>;
  listNotes(tenantId: string, employeeId: string): Promise<EmployeeNote[]>;
  listHistory(tenantId: string, employeeId: string): Promise<EmployeeHistoryEvent[]>;
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

function optionalValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizedAddress(address: EmployeeAddress | null | undefined): EmployeeAddress | null {
  if (!address) return null;
  return {
    street: address.street.trim(),
    number: optionalValue(address.number) ?? undefined,
    complement: optionalValue(address.complement) ?? undefined,
    district: optionalValue(address.district) ?? undefined,
    city: address.city.trim(),
    state: address.state.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
    country: address.country.trim() || 'Brasil',
  };
}

export function employeeMissingFields(
  profile: EmployeeProfile,
  hasIdentificationDocument: boolean,
) {
  const fields: string[] = [];
  if (!profile.identificationDocument) fields.push('identificationDocument');
  if (!profile.phone) fields.push('phone');
  if (!profile.personalEmail) fields.push('personalEmail');
  if (!profile.corporateEmail) fields.push('corporateEmail');
  if (!profile.address?.street || !profile.address.city || !profile.address.state || !profile.address.postalCode) {
    fields.push('address');
  }
  if (!profile.entryDate) fields.push('entryDate');
  if (!profile.professionalTitle) fields.push('professionalTitle');
  if (!hasIdentificationDocument) fields.push('identificationDocumentFile');
  return fields;
}

function normalizedProfile(profile: EmployeeProfile): EmployeeProfile {
  return {
    fullName: profile.fullName.trim(),
    personalEmail: optionalValue(profile.personalEmail)?.toLowerCase() ?? null,
    corporateEmail: optionalValue(profile.corporateEmail)?.toLowerCase() ?? null,
    phone: optionalValue(profile.phone),
    identificationDocument: optionalValue(profile.identificationDocument),
    address: normalizedAddress(profile.address),
    entryDate: optionalValue(profile.entryDate),
    professionalTitle: optionalValue(profile.professionalTitle),
    employmentType: profile.employmentType.trim().toLowerCase() || 'pj',
  };
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
      const profile = normalizedProfile({
        fullName: command.fullName,
        personalEmail: command.email ?? null,
        corporateEmail: null,
        phone: null,
        identificationDocument: command.document ?? null,
        address: null,
        entryDate: null,
        professionalTitle: null,
        employmentType: 'pj',
      });
      if (profile.fullName.length < 2) throw new InvalidEmployeeError('Informe o nome completo do funcionário.');
      if (command.userId && !await dependencies.repository.isUserLinkable(command.tenantId, command.userId)) {
        throw new InvalidEmployeeError('O usuário informado não está disponível neste tenant.');
      }

      const createdAt = dependencies.now();
      const missingFields = employeeMissingFields(profile, false);
      return dependencies.repository.create({
        id: dependencies.generateId(),
        tenantId: command.tenantId,
        userId: command.userId ?? null,
        ...profile,
        status: 'pre_registration',
        onboardingPending: missingFields.length > 0,
        missingFields,
        createdAt,
        inactivatedAt: null,
      }, command.actorUserId);
    },

    list(tenantId: string) {
      return dependencies.repository.list(tenantId);
    },

    get(tenantId: string, employeeId: string) {
      return dependencies.repository.get(tenantId, employeeId);
    },

    async update(command: {
      tenantId: string;
      employeeId: string;
      actorUserId: string;
      profile: EmployeeProfile;
      status: Exclude<EmployeeStatus, 'inactive'>;
    }) {
      const profile = normalizedProfile(command.profile);
      if (profile.fullName.length < 2) throw new InvalidEmployeeError('Informe o nome completo do funcionário.');
      const hasIdentificationDocument = await dependencies.repository.hasIdentificationDocument(
        command.tenantId,
        command.employeeId,
      );
      const missingFields = employeeMissingFields(profile, hasIdentificationDocument);
      if (command.status === 'active' && missingFields.length > 0) {
        throw new InvalidEmployeeError('Conclua as pendências de onboarding antes de ativar o funcionário.');
      }
      const employee = await dependencies.repository.update(
        command.tenantId,
        command.employeeId,
        profile,
        command.status,
        missingFields,
        command.actorUserId,
        dependencies.now(),
      );
      if (!employee) throw new Error('Funcionário não encontrado.');
      return employee;
    },

    async addNote(command: { tenantId: string; employeeId: string; actorUserId: string; content: string }) {
      const content = command.content.trim();
      if (content.length < 2 || content.length > 4000) {
        throw new InvalidEmployeeError('A anotação deve possuir entre 2 e 4.000 caracteres.');
      }
      const note = await dependencies.repository.addNote({
        id: dependencies.generateId(),
        tenantId: command.tenantId,
        employeeId: command.employeeId,
        authorUserId: command.actorUserId,
        content,
        createdAt: dependencies.now(),
      }, command.actorUserId);
      if (!note) throw new Error('Funcionário não encontrado.');
      return note;
    },

    async detail(tenantId: string, employeeId: string) {
      const employee = await dependencies.repository.get(tenantId, employeeId);
      if (!employee) return null;
      const [notes, history] = await Promise.all([
        dependencies.repository.listNotes(tenantId, employeeId),
        dependencies.repository.listHistory(tenantId, employeeId),
      ]);
      return { employee, notes, history };
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
