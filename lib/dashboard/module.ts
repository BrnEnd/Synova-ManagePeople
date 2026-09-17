import type { ManagementScope } from '@/lib/management/scope';

export type DashboardSnapshot = {
  activeEmployees: number;
  newHires: number;
  newHiresPending: number;
  notSubmittedMinutes: number;
  notSubmittedRevenueProjectionCents: number;
  unpricedNotSubmittedMinutes: number;
  awaitingApproval: number;
  awaitingInvoice: number;
  awaitingPayment: number;
  paymentForecastCents: number;
  revenueForecastCents: number;
};

export type DashboardRepository = {
  load(tenantId: string, managerUserId: string, scope: ManagementScope, period: { referenceMonth: string; monthStart: Date; nextMonthStart: Date; monthEnd: string }): Promise<DashboardSnapshot>;
};

export function saoPauloMonth(now: Date) {
  const parts = new Intl.DateTimeFormat('en', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    referenceMonth: `${year}-${String(month).padStart(2, '0')}-01`,
    monthStart: new Date(Date.UTC(year, month - 1, 1)),
    nextMonthStart: new Date(Date.UTC(nextYear, nextMonth - 1, 1)),
    monthEnd: new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10),
  };
}

export function createDashboardModule(dependencies: { repository: DashboardRepository; now: () => Date }) {
  return {
    load(tenantId: string, managerUserId: string, scope: ManagementScope = 'mine') {
      return dependencies.repository.load(tenantId, managerUserId, scope, saoPauloMonth(dependencies.now()));
    },
  };
}
