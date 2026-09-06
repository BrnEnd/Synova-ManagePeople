import 'server-only';
import { randomUUID } from 'node:crypto';
import { sendPortalAccessNotification } from '@/lib/employee-access/email';
import { createEmployeeAccessModule } from '@/lib/employee-access/module';
import { PostgresEmployeeAccessAccounts } from '@/lib/employee-access/postgres-repository';
import { hashPassword } from '@/lib/identity/password';

export function getEmployeeAccessModule() {
  const idempotencySecret = process.env.PROVISIONING_IDEMPOTENCY_SECRET;
  if (!idempotencySecret) throw new Error('PROVISIONING_IDEMPOTENCY_SECRET não configurado.');

  return createEmployeeAccessModule({
    accounts: new PostgresEmployeeAccessAccounts(),
    notify: sendPortalAccessNotification,
    hashPassword,
    idempotencySecret,
    generateId: randomUUID,
    now: () => new Date(),
    onNotificationError: ({ employeeId, userId, error }) => {
      console.error('Acesso criado, mas a notificação interna falhou:', {
        employeeId,
        userId,
        providerErrorType: error instanceof Error ? error.name : 'UnknownProviderError',
      });
    },
  });
}
