import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import {
  documentOnboardingFiles,
  documentOnboardingItems,
  documentOnboardingRequests,
  documents,
  employees,
  notifications,
  users,
  type DocumentOnboardingFormData,
} from '@/lib/db/schema';
import type { DatabaseTransaction } from '@/lib/db/transactions';
import {
  type OnboardingEmploymentType,
  type OnboardingItemStatus,
  type OnboardingRequestStatus,
} from '@/lib/document-onboarding/domain';
import { parseOnboardingToken, onboardingTokenMatches } from '@/lib/document-onboarding/token';
import {
  isOnboardingEmploymentType,
  isOnboardingItemStatus,
  isOnboardingRequestStatus,
} from '@/lib/document-onboarding/types';

export const LINK_LIFETIME_MS = 15 * 24 * 60 * 60 * 1000;

export class DocumentOnboardingError extends Error {
  constructor(message: string, readonly status = 422) {
    super(message);
    this.name = 'DocumentOnboardingError';
  }
}

export function expiryFrom(now: Date) {
  return new Date(now.getTime() + LINK_LIFETIME_MS);
}

export async function notifyManagers(
  tx: DatabaseTransaction,
  input: { tenantId: string; employeeId: string; type: string; title: string; message: string; key: string },
) {
  const managers = await tx.select({ id: users.id }).from(users).where(and(
    eq(users.tenantId, input.tenantId), eq(users.role, 'manager'), eq(users.status, 'active'),
  ));
  if (!managers.length) return;
  await tx.insert(notifications).values(managers.map((manager) => ({
    id: randomUUID(), tenantId: input.tenantId, recipientUserId: manager.id, employeeId: input.employeeId,
    competenceId: null, type: input.type, title: input.title, message: input.message,
    deduplicationKey: `${input.key}:${manager.id}`, createdAt: new Date(),
  }))).onConflictDoNothing();
}

export function requestStatus(value: string) {
  if (!isOnboardingRequestStatus(value)) throw new Error('Estado de solicitação documental inválido.');
  return value;
}

export function itemStatus(value: string) {
  if (!isOnboardingItemStatus(value)) throw new Error('Estado de item documental inválido.');
  return value;
}

export function employmentType(value: string) {
  if (!isOnboardingEmploymentType(value)) throw new Error('Tipo de vínculo documental inválido.');
  return value;
}

export type ManagerOnboardingDetail = {
  request: {
    id: string;
    employmentType: OnboardingEmploymentType;
    status: OnboardingRequestStatus;
    expiresAt: string;
    submittedAt: string | null;
    approvedAt: string | null;
    revision: number;
    hasUploads: boolean;
    data: DocumentOnboardingFormData;
  };
  items: Array<{
    id: string;
    key: string;
    label: string;
    required: boolean;
    status: OnboardingItemStatus;
    reviewable: boolean;
    rejectionReason: string | null;
    files: Array<{ id: string; documentId: string; originalName: string; size: number; mimeType: string; version: number; active: boolean }>;
  }>;
};

export type PublicOnboardingDetail = ManagerOnboardingDetail & {
  employee: { id: string; fullName: string };
  blobEnabled: boolean;
};

export async function loadDetail(tx: DatabaseTransaction, tenantId: string, requestId: string) {
  const [request] = await tx.select().from(documentOnboardingRequests).where(and(
    eq(documentOnboardingRequests.tenantId, tenantId), eq(documentOnboardingRequests.id, requestId),
  )).limit(1);
  if (!request) return null;
  const rows = await tx.select({
    item: documentOnboardingItems,
    fileId: documentOnboardingFiles.id,
    documentId: documentOnboardingFiles.documentId,
    version: documentOnboardingFiles.version,
    active: documentOnboardingFiles.active,
    originalName: documents.originalName,
    size: documents.size,
    mimeType: documents.mimeType,
  }).from(documentOnboardingItems)
    .leftJoin(documentOnboardingFiles, and(
      eq(documentOnboardingFiles.tenantId, documentOnboardingItems.tenantId),
      eq(documentOnboardingFiles.itemId, documentOnboardingItems.id),
    ))
    .leftJoin(documents, and(
      eq(documents.tenantId, documentOnboardingFiles.tenantId),
      eq(documents.id, documentOnboardingFiles.documentId),
    ))
    .where(and(eq(documentOnboardingItems.tenantId, tenantId), eq(documentOnboardingItems.requestId, requestId)))
    .orderBy(asc(documentOnboardingItems.position), desc(documentOnboardingFiles.version), asc(documents.createdAt));

  const items = new Map<string, ManagerOnboardingDetail['items'][number]>();
  for (const row of rows) {
    const current = items.get(row.item.id) ?? {
      id: row.item.id, key: row.item.key, label: row.item.label, required: row.item.required,
      status: itemStatus(row.item.status), reviewable: row.item.reviewable,
      rejectionReason: row.item.rejectionReason, files: [],
    };
    if (row.fileId && row.documentId && row.originalName && row.size !== null && row.mimeType) {
      current.files.push({ id: row.fileId, documentId: row.documentId, originalName: row.originalName, size: row.size, mimeType: row.mimeType, version: row.version!, active: row.active! });
    }
    items.set(row.item.id, current);
  }
  return {
    request: {
      id: request.id, employmentType: employmentType(request.employmentType), status: requestStatus(request.status),
      expiresAt: request.expiresAt.toISOString(), submittedAt: request.submittedAt?.toISOString() ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null, revision: request.revision,
      hasUploads: request.hasUploads, data: request.data,
    },
    items: [...items.values()], rawRequest: request,
  };
}

export async function authorizedPublicDetail(tx: DatabaseTransaction, token: string, now = new Date()) {
  const parsed = parseOnboardingToken(token);
  if (!parsed) throw new DocumentOnboardingError('Link inválido.', 404);
  const detail = await loadDetail(tx, parsed.tenantId, parsed.requestId);
  if (!detail || !onboardingTokenMatches(token, detail.rawRequest.tokenHash)) {
    throw new DocumentOnboardingError('Link inválido ou substituído.', 404);
  }
  if (detail.rawRequest.expiresAt.getTime() < now.getTime()) {
    throw new DocumentOnboardingError('Este link expirou. Solicite à Synova uma nova validade.', 410);
  }
  const [employee] = await tx.select({ id: employees.id, fullName: employees.fullName }).from(employees).where(and(
    eq(employees.tenantId, parsed.tenantId), eq(employees.id, detail.rawRequest.employeeId),
  )).limit(1);
  if (!employee) throw new DocumentOnboardingError('Funcionário não encontrado.', 404);
  return { parsed, detail, employee };
}
