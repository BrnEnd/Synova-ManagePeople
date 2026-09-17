import { authorizedManager } from '@/lib/approvals/http';
import { getApprovalsModule } from '@/lib/approvals/server';
import { managementScope } from '@/lib/management/scope';
export async function GET(request: Request) { const { identity, response } = await authorizedManager(); if (!identity) return response; const scope = managementScope(new URL(request.url).searchParams.get('scope') || undefined); return Response.json({ competencies: await getApprovalsModule().listForManager(identity.tenantId, identity.id, undefined, scope) }); }
