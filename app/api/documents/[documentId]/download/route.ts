import { getDocumentsModule } from '@/lib/documents/server';
import { readDocument } from '@/lib/documents/storage';
import { managerAccess, managerAccessResponse } from '@/lib/identity/access';
import { getEmployeesModule } from '@/lib/employees/server';
import { getCurrentIdentity } from '@/lib/identity/server';

export async function GET(_request: Request, context: RouteContext<'/api/documents/[documentId]/download'>) {
  const identity = await getCurrentIdentity();
  if (!identity) return managerAccessResponse('unauthenticated');
  if (identity.mustChangePassword) return managerAccessResponse('password_change_required');
  const { documentId } = await context.params;
    const document = await getDocumentsModule().get(identity.tenantId, documentId);
    if (!document) return Response.json({ error: 'Documento não encontrado.' }, { status: 404 });
    if (managerAccess(identity) !== 'allowed') { const employee = await getEmployeesModule().get(identity.tenantId, document.employeeId); if (identity.role !== 'employee' || employee?.userId !== identity.id) return managerAccessResponse('forbidden'); }
  try {
    const content = await readDocument(document.pathname);
    if (!content) return Response.json({ error: 'Arquivo não encontrado no storage.' }, { status: 404 });
    const headers = new Headers();
    headers.set('content-type', document.mimeType);
    headers.set('content-length', String(document.size));
    headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`);
    headers.set('cache-control', 'private, no-store');
    return new Response(content.body, { headers });
  } catch (error) {
    console.error('Falha ao baixar documento:', error);
    return Response.json({ error: 'Não foi possível baixar o documento.' }, { status: 500 });
  }
}
