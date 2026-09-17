import { approvalError, authorizedManager } from '@/lib/approvals/http';
import { getApprovalsModule } from '@/lib/approvals/server';
import { managementScope } from '@/lib/management/scope';
export async function GET(request: Request, context: { params: Promise<{ competenceId: string }> }) { const { identity, response } = await authorizedManager(); if (!identity) return response; try { const { competenceId } = await context.params; const scope = managementScope(new URL(request.url).searchParams.get('scope') || undefined); return Response.json(await getApprovalsModule().getForManager(identity.tenantId, identity.id, competenceId, scope)); } catch (error) { return approvalError(error, 'Não foi possível consultar a competência.'); } }
