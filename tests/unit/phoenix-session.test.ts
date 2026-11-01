import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  auth: null as null | { principal: { id: string; isPlatformOwner: boolean }; apiKey?: unknown },
  owner: true,
}));

vi.mock('../../src/server/auth-context', () => ({ authenticateRequest: vi.fn(async () => state.auth) }));
vi.mock('../../src/server/db', () => ({ dbIsPlatformOwner: vi.fn(async () => state.owner) }));

import { signViewerToken, signSessionToken, verifyViewerToken, verifySessionToken } from '../../src/lib/session-token';
import { handlePhoenixSessionRoutes } from '../../src/routes/phoenix-session';

const ME = '11111111-1111-4111-8111-111111111111';

function call(method: string, path: string, headers: Record<string, string> = {}) {
  const out = { status: 0, headers: {} as Record<string, string>, body: '' };
  const res = {
    writeHead: (status: number, h: Record<string, string> = {}) => {
      out.status = status;
      out.headers = h;
    },
    end: (body?: string) => {
      out.body = body ?? '';
    },
  } as never;
  return handlePhoenixSessionRoutes({ method, headers } as never, res, new URL(`http://octo.test${path}`)).then(
    (handled) => ({ handled, ...out })
  );
}

describe('Phoenix sign-in from the Octo session (#445)', () => {
  beforeEach(() => {
    state.auth = { principal: { id: ME, isPlatformOwner: true } };
    state.owner = true;
  });

  it('sets a signed, scoped cookie for the platform owner', async () => {
    const result = await call('POST', '/api/phoenix/session');
    expect(result.status).toBe(200);
    const cookie = result.headers['Set-Cookie'] ?? '';
    expect(cookie).toMatch(/^octo_phoenix=/);
    expect(cookie).toContain('Path=/phoenix');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    const value = cookie.split(';')[0]!.slice('octo_phoenix='.length);
    expect(verifyViewerToken(value)).toBe(ME);
  });

  it('refuses no session, an API key, and anyone but the platform owner', async () => {
    state.auth = null;
    expect((await call('POST', '/api/phoenix/session')).status).toBe(401);
    state.auth = { principal: { id: ME, isPlatformOwner: true }, apiKey: {} };
    expect((await call('POST', '/api/phoenix/session')).status).toBe(403);
    state.auth = { principal: { id: ME, isPlatformOwner: false } };
    const refused = await call('POST', '/api/phoenix/session');
    expect(refused.status).toBe(403);
    expect(refused.headers['Set-Cookie']).toBeUndefined();
  });

  it('accepts a valid cookie while its principal is the owner', async () => {
    const cookie = `octo_phoenix=${signViewerToken(ME)}`;
    expect((await call('GET', '/api/phoenix/auth', { cookie })).status).toBe(200);
    expect((await call('GET', '/api/phoenix/auth', { cookie: `a=b; ${cookie}` })).status).toBe(200);
  });

  it('refuses a missing, forged, expired or demoted cookie', async () => {
    expect((await call('GET', '/api/phoenix/auth')).status).toBe(401);
    expect((await call('GET', '/api/phoenix/auth', { cookie: 'octo_phoenix=nope' })).status).toBe(401);
    const forged = `${ME}.${Math.floor(Date.now() / 1000) + 3600}.AAAA`;
    expect((await call('GET', '/api/phoenix/auth', { cookie: `octo_phoenix=${forged}` })).status).toBe(401);
    const expired = signViewerToken(ME, -10);
    expect((await call('GET', '/api/phoenix/auth', { cookie: `octo_phoenix=${expired}` })).status).toBe(401);
    state.owner = false;
    expect((await call('GET', '/api/phoenix/auth', { cookie: `octo_phoenix=${signViewerToken(ME)}` })).status).toBe(401);
  });

  it('keeps the cookie and the session token from standing in for each other', () => {
    expect(verifySessionToken(signViewerToken(ME))).toBeNull();
    expect(verifyViewerToken(signSessionToken(ME).replace('octo_sess_', ''))).toBeNull();
  });
});
