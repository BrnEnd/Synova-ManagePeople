import { createEmployeeAccessHttp } from '@/lib/employee-access/http';
import { getEmployeeAccessModule } from '@/lib/employee-access/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ employeeId: string }> },
) {
  const { employeeId } = await context.params;
  return createEmployeeAccessHttp({
    access: getEmployeeAccessModule(),
    getIdentity: getCurrentIdentity,
  }).create(request, employeeId);
}
