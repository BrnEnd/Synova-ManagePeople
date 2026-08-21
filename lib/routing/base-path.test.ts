import { describe, expect, it } from 'vitest';
import { portalPath } from './base-path';

describe('portalPath', () => {
  it('prefixes application and API paths exactly once', () => {
    expect(portalPath()).toBe('/portal');
    expect(portalPath('/entrar')).toBe('/portal/entrar');
    expect(portalPath('/api/auth/session')).toBe('/portal/api/auth/session');
    expect(portalPath('/portal/api/auth/session')).toBe('/portal/api/auth/session');
  });
});
