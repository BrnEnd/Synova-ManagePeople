import { isLastNationalBusinessDay, saoPauloDate } from '@/lib/calendar/business-days';
import type { Competence, TimeEntry } from '@/lib/timekeeping/module';

export type CompetenceEvent = { id: string; eventType: string; fromStatus: string; toStatus: string; reason: string | null; actorName: string | null; occurredAt: Date };
export type CompetenceReview = { competence: Competence & { employeeName: string }; entries: TimeEntry[]; events: CompetenceEvent[] };
export type Notification = { id: string; type: string; title: string; message: string; competenceId: string | null; readAt: Date | null; createdAt: Date };

export type ApprovalRepository = {
  submit(tenantId: string, employeeUserId: string, competenceId: string, eventId: string, notificationId: string, at: Date): Promise<CompetenceReview | null>;
  listForManager(tenantId: string, managerUserId: string): Promise<CompetenceReview[]>;
  getForManager(tenantId: string, managerUserId: string, competenceId: string): Promise<CompetenceReview | null>;
  requestAdjustments(tenantId: string, managerUserId: string, competenceId: string, reason: string, eventId: string, notificationId: string, at: Date): Promise<CompetenceReview | null>;
  approve(tenantId: string, managerUserId: string, competenceId: string, eventId: string, notificationId: string, at: Date): Promise<CompetenceReview | null>;
  listNotifications(tenantId: string, recipientUserId: string): Promise<Notification[]>;
  markNotificationRead(tenantId: string, recipientUserId: string, notificationId: string, at: Date): Promise<Notification | null>;
  listActiveTenantIds(): Promise<string[]>;
  createMonthCloseReminders(tenantId: string, referenceMonth: string, at: Date, generateId: () => string): Promise<number>;
};

export class InvalidApprovalError extends Error { constructor(message: string) { super(message); this.name = 'InvalidApprovalError'; } }

export function createApprovalsModule(dependencies: { repository: ApprovalRepository; generateId: () => string; now: () => Date }) {
  return {
    async submit(command: { tenantId: string; userId: string; competenceId: string }) {
      const review = await dependencies.repository.submit(command.tenantId, command.userId, command.competenceId, dependencies.generateId(), dependencies.generateId(), dependencies.now());
      if (!review) throw new Error('Competência não encontrada.'); return review;
    },
    listForManager(tenantId: string, managerUserId: string) { return dependencies.repository.listForManager(tenantId, managerUserId); },
    async getForManager(tenantId: string, managerUserId: string, competenceId: string) {
      const review = await dependencies.repository.getForManager(tenantId, managerUserId, competenceId);
      if (!review) throw new Error('Competência não encontrada.'); return review;
    },
    async requestAdjustments(command: { tenantId: string; managerUserId: string; competenceId: string; reason: string }) {
      const reason = command.reason.trim(); if (reason.length < 3 || reason.length > 2000) throw new InvalidApprovalError('Informe o motivo do ajuste entre 3 e 2.000 caracteres.');
      const review = await dependencies.repository.requestAdjustments(command.tenantId, command.managerUserId, command.competenceId, reason, dependencies.generateId(), dependencies.generateId(), dependencies.now());
      if (!review) throw new Error('Competência não encontrada.'); return review;
    },
    async approve(command: { tenantId: string; managerUserId: string; competenceId: string }) {
      const review = await dependencies.repository.approve(command.tenantId, command.managerUserId, command.competenceId, dependencies.generateId(), dependencies.generateId(), dependencies.now());
      if (!review) throw new Error('Competência não encontrada.'); return review;
    },
    listNotifications(tenantId: string, userId: string) { return dependencies.repository.listNotifications(tenantId, userId); },
    async markNotificationRead(tenantId: string, userId: string, notificationId: string) {
      const notification = await dependencies.repository.markNotificationRead(tenantId, userId, notificationId, dependencies.now());
      if (!notification) throw new Error('Notificação não encontrada.'); return notification;
    },
    async runMonthCloseReminders(now = dependencies.now()) {
      if (!isLastNationalBusinessDay(now)) return { processed: false, localDate: saoPauloDate(now), notifications: 0 };
      const localDate = saoPauloDate(now); const referenceMonth = `${localDate.slice(0, 7)}-01`;
      const tenantIds = await dependencies.repository.listActiveTenantIds(); let notifications = 0;
      for (const tenantId of tenantIds) notifications += await dependencies.repository.createMonthCloseReminders(tenantId, referenceMonth, now, dependencies.generateId);
      return { processed: true, localDate, notifications };
    },
  };
}
