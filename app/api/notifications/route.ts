import { authorizedAnyUser } from '@/lib/approvals/http';
import { getApprovalsModule } from '@/lib/approvals/server';
export async function GET() { const { identity, response } = await authorizedAnyUser(); if (!identity) return response; return Response.json({ notifications: await getApprovalsModule().listNotifications(identity.tenantId, identity.id) }); }
