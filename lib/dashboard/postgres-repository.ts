import 'server-only';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { commercialConditions, competencies, employees, timeEntries } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { DashboardRepository, DashboardSnapshot } from '@/lib/dashboard/module';
import type { ManagementScope } from '@/lib/management/scope';

export class PostgresDashboardRepository implements DashboardRepository {
  load(tenantId: string, managerUserId: string, scope: ManagementScope, period: { referenceMonth: string; monthStart: Date; nextMonthStart: Date; monthEnd: string }) {
    return withTenantTransaction(tenantId, async (tx): Promise<DashboardSnapshot> => {
      const [employeeRows, notSubmittedRows, competenceRows] = await Promise.all([
        tx.select({ id: employees.id, status: employees.status, onboardingPending: employees.onboardingPending, createdAt: employees.createdAt })
          .from(employees).where(eq(employees.tenantId, tenantId)),
        tx.select({ minutes: timeEntries.minutes, commercialRateCents: commercialConditions.hourlyRateCents })
          .from(competencies)
          .innerJoin(timeEntries, and(eq(timeEntries.tenantId, competencies.tenantId), eq(timeEntries.competenceId, competencies.id)))
          .leftJoin(commercialConditions, and(
            eq(commercialConditions.tenantId, timeEntries.tenantId),
            eq(commercialConditions.allocationId, timeEntries.allocationId),
            lte(commercialConditions.effectiveFrom, timeEntries.workDate),
            or(isNull(commercialConditions.effectiveTo), gte(commercialConditions.effectiveTo, timeEntries.workDate)),
          ))
          .where(and(
            eq(competencies.tenantId, tenantId),
            eq(competencies.referenceMonth, period.referenceMonth),
            inArray(competencies.status, ['filling', 'adjustments_requested']),
            scope === 'mine' ? eq(competencies.managerUserId, managerUserId) : undefined,
          )),
        tx.select({ id: competencies.id, status: competencies.status, approvedMinutes: competencies.approvedMinutes, approvedAmountCents: competencies.approvedAmountCents, approvedRevenueCents: competencies.approvedRevenueCents })
          .from(competencies)
          .where(and(eq(competencies.tenantId, tenantId), eq(competencies.managerUserId, managerUserId), eq(competencies.referenceMonth, period.referenceMonth))),
      ]);

      const activeEmployees = employeeRows.filter((employee) => employee.status === 'active').length;
      const newEmployees = employeeRows.filter((employee) => employee.createdAt >= period.monthStart && employee.createdAt < period.nextMonthStart);
      const notSubmittedMinutes = notSubmittedRows.reduce((total, row) => total + row.minutes, 0);
      const unpricedNotSubmittedMinutes = notSubmittedRows.reduce((total, row) => total + (row.commercialRateCents ? 0 : row.minutes), 0);
      const notSubmittedRevenueProjectionCents = Math.round(notSubmittedRows.reduce(
        (total, row) => total + (row.commercialRateCents ? row.minutes * row.commercialRateCents / 60 : 0), 0,
      ));
      const approved = competenceRows.filter((row) => row.status === 'awaiting_invoice' || row.status === 'awaiting_payment' || row.status === 'paid');

      return {
        activeEmployees,
        newHires: newEmployees.length,
        newHiresPending: newEmployees.filter((employee) => employee.onboardingPending && employee.status !== 'inactive').length,
        notSubmittedMinutes,
        notSubmittedRevenueProjectionCents,
        unpricedNotSubmittedMinutes,
        awaitingApproval: competenceRows.filter((row) => row.status === 'awaiting_approval').length,
        awaitingInvoice: competenceRows.filter((row) => row.status === 'awaiting_invoice').length,
        awaitingPayment: competenceRows.filter((row) => row.status === 'awaiting_payment').length,
        paymentForecastCents: approved.reduce((total, row) => total + (row.approvedAmountCents ?? 0), 0),
        revenueForecastCents: approved.reduce((total, row) => total + (row.approvedRevenueCents ?? 0), 0),
      };
    });
  }
}
