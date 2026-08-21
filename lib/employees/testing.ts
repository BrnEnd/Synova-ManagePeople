import type {
  Employee,
  EmployeeHistoryEvent,
  EmployeeNote,
  EmployeeRepository,
} from '@/lib/employees/module';

export class InMemoryEmployeeRepository implements EmployeeRepository {
  readonly events: Array<{ eventType: string; employeeId: string }> = [];
  private employees: Employee[] = [];
  private readonly linkableUsers = new Set<string>();
  private readonly identificationDocuments = new Set<string>();
  private readonly notes: EmployeeNote[] = [];
  private readonly history: EmployeeHistoryEvent[] = [];

  addLinkableUser(tenantId: string, userId: string) {
    this.linkableUsers.add(`${tenantId}:${userId}`);
  }

  addIdentificationDocument(tenantId: string, employeeId: string) {
    this.identificationDocuments.add(`${tenantId}:${employeeId}`);
  }

  async isUserLinkable(tenantId: string, userId: string, employeeId?: string) {
    if (!this.linkableUsers.has(`${tenantId}:${userId}`)) return false;
    return !this.employees.some((employee) => employee.userId === userId
      && employee.tenantId === tenantId
      && employee.id !== employeeId);
  }

  async hasIdentificationDocument(tenantId: string, employeeId: string) {
    return this.identificationDocuments.has(`${tenantId}:${employeeId}`);
  }

  async create(employee: Employee) {
    this.employees.push(employee);
    this.events.push({ eventType: 'employee.created', employeeId: employee.id });
    return employee;
  }

  async list(tenantId: string) {
    return this.employees.filter((employee) => employee.tenantId === tenantId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  async get(tenantId: string, employeeId: string) {
    return this.employees.find((employee) => employee.tenantId === tenantId && employee.id === employeeId) ?? null;
  }

  async update(
    tenantId: string,
    employeeId: string,
    profile: Parameters<EmployeeRepository['update']>[2],
    status: Parameters<EmployeeRepository['update']>[3],
    missingFields: string[],
  ) {
    const employee = this.employees.find((item) => item.id === employeeId && item.tenantId === tenantId);
    if (!employee || employee.status === 'inactive') return null;
    Object.assign(employee, profile, { status, missingFields, onboardingPending: missingFields.length > 0 });
    this.events.push({ eventType: 'employee.updated', employeeId });
    return employee;
  }

  async addNote(note: Omit<EmployeeNote, 'authorName'>) {
    const employee = this.employees.find((item) => item.id === note.employeeId && item.tenantId === note.tenantId);
    if (!employee) return null;
    const created = { ...note, authorName: 'Gestor de teste' };
    this.notes.push(created);
    this.events.push({ eventType: 'employee.note_added', employeeId: note.employeeId });
    return created;
  }

  async listNotes(tenantId: string, employeeId: string) {
    return this.notes.filter((note) => note.tenantId === tenantId && note.employeeId === employeeId);
  }

  async listHistory(_tenantId: string, employeeId: string) {
    return this.history.filter((event) => event.metadata.employeeId === employeeId);
  }

  async inactivate(tenantId: string, employeeId: string, _actorUserId: string, at: Date) {
    const employee = this.employees.find((item) => item.id === employeeId && item.tenantId === tenantId);
    if (!employee || employee.status === 'inactive') return null;
    employee.status = 'inactive';
    employee.inactivatedAt = at;
    this.events.push({ eventType: 'employee.inactivated', employeeId });
    return employee;
  }

  async associateUser(tenantId: string, employeeId: string, userId: string) {
    const employee = this.employees.find((item) => item.id === employeeId && item.tenantId === tenantId);
    if (!employee) return null;
    employee.userId = userId;
    this.events.push({ eventType: 'employee.user_associated', employeeId });
    return employee;
  }
}
