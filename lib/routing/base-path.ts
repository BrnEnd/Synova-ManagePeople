export const PORTAL_BASE_PATH = '/portal';

export function portalPath(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (normalized === '/') return PORTAL_BASE_PATH;
  if (normalized === PORTAL_BASE_PATH || normalized.startsWith(`${PORTAL_BASE_PATH}/`)) return normalized;
  return `${PORTAL_BASE_PATH}${normalized}`;
}
