import { NextResponse, type NextRequest } from 'next/server';
import { PORTAL_BASE_PATH } from '@/lib/routing/base-path';

const DEFAULT_CANONICAL_URL = 'https://www.synovadigital.com.br/portal';
const CRON_PATH = '/api/internal/jobs/month-close-reminders';

function normalizedPath(pathname: string) {
  if (pathname === PORTAL_BASE_PATH) return '/';
  return pathname.startsWith(`${PORTAL_BASE_PATH}/`)
    ? pathname.slice(PORTAL_BASE_PATH.length)
    : pathname;
}

function canonicalUrl(request: NextRequest) {
  const base = (process.env.CANONICAL_PORTAL_URL || DEFAULT_CANONICAL_URL).replace(/\/$/, '');
  const pathname = normalizedPath(request.nextUrl.pathname);
  return new URL(`${base}${pathname === '/' ? '' : pathname}${request.nextUrl.search}`);
}

export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== 'production') return NextResponse.next();

  const pathname = normalizedPath(request.nextUrl.pathname);
  if (pathname === CRON_PATH) return NextResponse.next();

  const expected = process.env.PORTAL_PROXY_SECRET;
  const received = request.headers.get('x-synova-portal-proxy');
  if (expected && received === expected) return NextResponse.next();

  return NextResponse.redirect(canonicalUrl(request), 307);
}
