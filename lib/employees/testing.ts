import type { Employee, EmployeeRepository } from '@/lib/employees/module';

export class InMemoryEmployeeRepository implements EmployeeRepository {
  readonly events: Array<{ eventType: string; employeeId: string }> = [];
  private employees: Employee[] = [];
  private readonly linkableUsers = new Set<string>();

  addLinkableUser(tenantId: string, userId: string) {
    this.linkableUsers.add(`${tenantId}:${userId}`);
  }

  async isUserLinkable(tenantId: string, userId: string, employeeId?: string) {
    if (!this.linkableUsers.has(`${tenantId}:${userId}`)) return false;
    return !this.employees.some((employee) => employee.userId === userId
      && employee.tenantId === tenantId
      && employee.id !== employeeId);
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
