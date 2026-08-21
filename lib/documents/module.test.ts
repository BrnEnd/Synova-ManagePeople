import { describe, expect, test } from 'vitest';
import {
  InvalidDocumentError,
  MAX_DOCUMENT_SIZE,
  createDocumentsModule,
} from '@/lib/documents/module';
import { InMemoryDocumentRepository } from '@/lib/documents/testing';

function subject() {
  const repository = new InMemoryDocumentRepository();
  let sequence = 0;
  return {
    repository,
    module: createDocumentsModule({
      repository,
      generateId: () => `document-${++sequence}`,
      now: () => new Date('2026-08-21T12:00:00.000Z'),
    }),
  };
}

describe('documentos', () => {
  test('registra PDF contextualizado e repete o mesmo pathname sem duplicar', async () => {
    const { module, repository } = subject();
    repository.addEmployee('tenant-a', 'employee-a');
    const command = {
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      type: 'identification' as const, origin: 'manager' as const, originalName: 'identidade.pdf',
      pathname: 'tenants/tenant-a/employees/employee-a/file.pdf', mimeType: 'application/pdf', size: 1024,
    };

    await expect(module.recordUpload(command)).resolves.toMatchObject({ replayed: false });
    await expect(module.recordUpload(command)).resolves.toMatchObject({ replayed: true });
    expect(repository.documents).toHaveLength(1);
  });

  test.each(['text/plain', 'image/svg+xml', 'application/zip'])('rejeita tipo não permitido: %s', async (mimeType) => {
    const { module, repository } = subject();
    repository.addEmployee('tenant-a', 'employee-a');
    await expect(module.recordUpload({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      type: 'other', origin: 'manager', originalName: 'arquivo',
      pathname: 'tenants/tenant-a/employees/employee-a/file', mimeType, size: 100,
    })).rejects.toBeInstanceOf(InvalidDocumentError);
  });

  test('rejeita arquivo acima de 25 MB', async () => {
    const { module, repository } = subject();
    repository.addEmployee('tenant-a', 'employee-a');
    await expect(module.recordUpload({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      type: 'identification', origin: 'manager', originalName: 'arquivo.pdf',
      pathname: 'tenants/tenant-a/employees/employee-a/file.pdf', mimeType: 'application/pdf',
      size: MAX_DOCUMENT_SIZE + 1,
    })).rejects.toThrow('no máximo 25 MB');
  });

  test('rejeita pathname de outro tenant ou funcionário', async () => {
    const { module, repository } = subject();
    repository.addEmployee('tenant-a', 'employee-a');
    await expect(module.recordUpload({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      type: 'identification', origin: 'manager', originalName: 'arquivo.pdf',
      pathname: 'tenants/tenant-b/employees/employee-a/file.pdf', mimeType: 'application/pdf', size: 100,
    })).rejects.toThrow('não corresponde');
  });

  test('não retorna documento para outro tenant', async () => {
    const { module, repository } = subject();
    repository.addEmployee('tenant-a', 'employee-a');
    const result = await module.recordUpload({
      tenantId: 'tenant-a', employeeId: 'employee-a', actorUserId: 'manager-a',
      type: 'identification', origin: 'manager', originalName: 'arquivo.pdf',
      pathname: 'tenants/tenant-a/employees/employee-a/file.pdf', mimeType: 'application/pdf', size: 100,
    });
    await expect(module.get('tenant-b', result.document.id)).resolves.toBeNull();
  });
});
