import { authorizedManager } from '@/lib/approvals/http';
import { getApprovalsModule } from '@/lib/approvals/server';
export async function GET() { const { identity, response } = await authorizedManager(); if (!identity) return response; return Response.json({ competencies: await getApprovalsModule().listForManager(identity.tenantId, identity.id) }); }
