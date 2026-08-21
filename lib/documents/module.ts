export const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024;
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type DocumentType =
  | 'identification'
  | 'address_proof'
  | 'contract'
  | 'payment_forecast'
  | 'invoice'
  | 'payment_receipt'
  | 'other';

export type DocumentOrigin = 'manager' | 'employee' | 'integration' | 'generated';

export type EmployeeDocument = {
  id: string;
  tenantId: string;
  employeeId: string;
  type: DocumentType;
  origin: DocumentOrigin;
  originalName: string;
  pathname: string;
  mimeType: string;
  size: number;
  uploadedByUserId: string | null;
  createdAt: Date;
  archivedAt: Date | null;
};

export type DocumentRepository = {
  createIdempotently(document: EmployeeDocument): Promise<{ document: EmployeeDocument; replayed: boolean }>;
  listForEmployee(tenantId: string, employeeId: string): Promise<EmployeeDocument[]>;
  get(tenantId: string, documentId: string): Promise<EmployeeDocument | null>;
};

type Dependencies = {
  repository: DocumentRepository;
  generateId: () => string;
  now: () => Date;
};

export class InvalidDocumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentError';
  }
}

export function documentPathPrefix(tenantId: string, employeeId: string) {
  return `tenants/${tenantId}/employees/${employeeId}/`;
}

export function validateDocumentFile(input: { mimeType: string; size: number }) {
  if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(input.mimeType as typeof ALLOWED_DOCUMENT_MIME_TYPES[number])) {
    throw new InvalidDocumentError('Envie um arquivo PDF, JPEG, PNG ou WebP.');
  }
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_DOCUMENT_SIZE) {
    throw new InvalidDocumentError('O arquivo deve possuir no máximo 25 MB.');
  }
}

export function createDocumentsModule(dependencies: Dependencies) {
  return {
    async recordUpload(command: {
      tenantId: string;
      employeeId: string;
      actorUserId: string | null;
      type: DocumentType;
      origin: DocumentOrigin;
      originalName: string;
      pathname: string;
      mimeType: string;
      size: number;
    }) {
      validateDocumentFile(command);
      if (!command.pathname.startsWith(documentPathPrefix(command.tenantId, command.employeeId))) {
        throw new InvalidDocumentError('O caminho do documento não corresponde ao funcionário informado.');
      }
      const originalName = command.originalName.trim();
      if (!originalName || originalName.length > 255) {
        throw new InvalidDocumentError('O nome original do arquivo é inválido.');
      }
      return dependencies.repository.createIdempotently({
        id: dependencies.generateId(),
        tenantId: command.tenantId,
        employeeId: command.employeeId,
        type: command.type,
        origin: command.origin,
        originalName,
        pathname: command.pathname,
        mimeType: command.mimeType,
        size: command.size,
        uploadedByUserId: command.actorUserId,
        createdAt: dependencies.now(),
        archivedAt: null,
      });
    },

    listForEmployee(tenantId: string, employeeId: string) {
      return dependencies.repository.listForEmployee(tenantId, employeeId);
    },

    get(tenantId: string, documentId: string) {
      return dependencies.repository.get(tenantId, documentId);
    },
  };
}
