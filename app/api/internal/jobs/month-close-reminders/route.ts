import { timingSafeEqual } from 'node:crypto';
import { getApprovalsModule } from '@/lib/approvals/server';
import { getDocumentOnboardingService } from '@/lib/document-onboarding/server';
function authorized(request: Request) { const secret = process.env.CRON_SECRET; const header = request.headers.get('authorization'); if (!secret || secret.length < 32 || !header?.startsWith('Bearer ')) return false; const provided = Buffer.from(header.slice(7)); const expected = Buffer.from(secret); return provided.length === expected.length && timingSafeEqual(provided, expected); }
export async function GET(request: Request) { if (!authorized(request)) return Response.json({ error: 'Não autorizado.' }, { status: 401 }); const [monthClose, documentation] = await Promise.all([getApprovalsModule().runMonthCloseReminders(), getDocumentOnboardingService().runReminders()]); return Response.json({ monthClose, documentation }); }
export const POST = GET;
