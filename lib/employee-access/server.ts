import 'server-only';
import { InvalidEmployeeError } from '@/lib/employees/module';
import { getEmployeesModule } from '@/lib/employees/server';
import { sendPortalAccessNotification } from '@/lib/employee-access/email';
import {
  EmployeeAccessConflictError,
  createEmployeeAccessModule,
} from '@/lib/employee-access/module';
import { IdempotencyConflictError } from '@/lib/provisioning/module';
import { getProvisioningModule } from '@/lib/provisioning/server';

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '23505');
}

export function getEmployeeAccessModule() {
  const employees = getEmployeesModule();
  const provisioning = getProvisioningModule();

  return createEmployeeAccessModule({
    accounts: {
      getEmployee: (tenantId, employeeId) => employees.get(tenantId, employeeId),
      async createUser(input) {
        try {
          const result = await provisioning.createUser({
            ...input,
            role: 'employee',
          });
          return {
            id: result.user.id,
            tenantId: result.user.tenantId,
            email: result.user.email,
            displayName: result.user.displayName,
            role: 'employee',
            mustChangePassword: true,
            replayed: result.replayed,
          };
        } catch (error) {
          if (error instanceof IdempotencyConflictError || isUniqueViolation(error)) {
            throw new EmployeeAccessConflictError();
          }
          throw error;
        }
      },
      async associateUser(input) {
        try {
          await employees.associateUser(input);
        } catch (error) {
          if (error instanceof InvalidEmployeeError) {
            throw new EmployeeAccessConflictError(error.message);
          }
          throw error;
        }
      },
    },
    notify: sendPortalAccessNotification,
    onNotificationError: ({ employeeId, userId, error }) => {
      console.error('Acesso criado, mas a notificação interna falhou:', {
        employeeId,
        userId,
        error: error instanceof Error ? error.message : 'Erro desconhecido do provedor.',
      });
    },
  });
}
