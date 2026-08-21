import 'server-only';
import { and, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { allocations, commercialConditions, competencies, employees } from '@/lib/db/schema';
import { withTenantTransaction } from '@/lib/db/transactions';
import type { DashboardRepository, DashboardSnapshot } from '@/lib/dashboard/module';

export class PostgresDashboardRepository implements DashboardRepository {
  load(tenantId: string, managerUserId: string, period: { referenceMonth: string; monthStart: Date; nextMonthStart: Date; monthEnd: string }) {
    return withTenantTransaction(tenantId, async (tx): Promise<DashboardSnapshot> => {
      const [employeeRows, allocationRows, competenceRows] = await Promise.all([
        tx.select({ id: employees.id, status: employees.status, onboardingPending: employees.onboardingPending, createdAt: employees.createdAt })
          .from(employees).where(eq(employees.tenantId, tenantId)),
        tx.select({ employeeId: allocations.employeeId, competenceStatus: competencies.status })
          .from(allocations)
          .innerJoin(employees, and(eq(employees.tenantId, allocations.tenantId), eq(employees.id, allocations.employeeId)))
          .leftJoin(competencies, and(eq(competencies.tenantId, allocations.tenantId), eq(competencies.employeeId, allocations.employeeId), eq(competencies.referenceMonth, period.referenceMonth)))
          .where(and(eq(allocations.tenantId, tenantId), eq(allocations.managerUserId, managerUserId), eq(employees.status, 'active'), lte(allocations.startDate, period.monthEnd), or(isNull(allocations.endDate), gte(allocations.endDate, period.referenceMonth)))),
        tx.select({ id: competencies.id, status: competencies.status, approvedMinutes: competencies.approvedMinutes, approvedAmountCents: competencies.approvedAmountCents, commercialRateCents: commercialConditions.hourlyRateCents })
          .from(competencies)
          .leftJoin(commercialConditions, and(eq(commercialConditions.tenantId, competencies.tenantId), eq(commercialConditions.allocationId, competencies.allocationId), lte(commercialConditions.effectiveFrom, period.monthEnd), or(isNull(commercialConditions.effectiveTo), gte(commercialConditions.effectiveTo, period.referenceMonth))))
          .where(and(eq(competencies.tenantId, tenantId), eq(competencies.managerUserId, managerUserId), eq(competencies.referenceMonth, period.referenceMonth))),
      ]);

      const activeEmployees = employeeRows.filter((employee) => employee.status === 'active').length;
      const newEmployees = employeeRows.filter((employee) => employee.createdAt >= period.monthStart && employee.createdAt < period.nextMonthStart);
      const employeeCompetence = new Map<string, string | null>();
      for (const row of allocationRows) employeeCompetence.set(row.employeeId, row.competenceStatus);
      const notSubmitted = [...employeeCompetence.values()].filter((status) => !status || status === 'filling' || status === 'adjustments_requested').length;
      const approved = competenceRows.filter((row) => row.status === 'awaiting_invoice' || row.status === 'awaiting_payment' || row.status === 'paid');

      return {
        activeEmployees,
        newHires: newEmployees.length,
        newHiresPending: newEmployees.filter((employee) => employee.onboardingPending && employee.status !== 'inactive').length,
        notSubmitted,
        awaitingApproval: competenceRows.filter((row) => row.status === 'awaiting_approval').length,
        awaitingInvoice: competenceRows.filter((row) => row.status === 'awaiting_invoice').length,
        awaitingPayment: competenceRows.filter((row) => row.status === 'awaiting_payment').length,
        paymentForecastCents: approved.reduce((total, row) => total + (row.approvedAmountCents ?? 0), 0),
        revenueForecastCents: approved.reduce((total, row) => total + (row.approvedMinutes && row.commercialRateCents ? Math.round(row.approvedMinutes * row.commercialRateCents / 60) : 0), 0),
      };
    });
  }
}
