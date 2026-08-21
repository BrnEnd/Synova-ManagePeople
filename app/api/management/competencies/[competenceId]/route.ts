import { approvalError, authorizedManager } from '@/lib/approvals/http';
import { getApprovalsModule } from '@/lib/approvals/server';
export async function GET(_request: Request, context: { params: Promise<{ competenceId: string }> }) { const { identity, response } = await authorizedManager(); if (!identity) return response; try { const { competenceId } = await context.params; return Response.json(await getApprovalsModule().getForManager(identity.tenantId, identity.id, competenceId)); } catch (error) { return approvalError(error, 'Não foi possível consultar a competência.'); } }
