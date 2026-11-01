import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ member: true, websiteId: 'site-1' as string | null, keyWorkspace: null as string | null }));
const readMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/server/auth-context', () => ({
  authenticateRequest: vi.fn(async () => ({ principal: { id: 'p1', email: 'a@b.c' }, scopes: ['read'] })),
  requireScope: vi.fn(() => true),
  scopeDenied: vi.fn(),
  roleAllows: vi.fn(() => true),
  keyWorkspaceMatches: vi.fn((_a: unknown, id: string) => state.keyWorkspace === null || state.keyWorkspace === id),
}));
vi.mock('../../src/server/db', () => ({
  dbGetWorkspaceMembership: vi.fn(async () => (state.member ? { role: 'member' } : null)),
  dbGetWorkspaceById: vi.fn(async () => ({ id: 'w', slug: 's', name: 'S' })),
  dbGetWorkspaceUmami: vi.fn(async () => ({ teamId: 't1', websiteId: state.websiteId })),
  dbListWorkspaceMemberEmails: vi.fn(),
  dbSetWorkspaceUmami: vi.fn(),
}));
vi.mock('../../src/lib/umami', () => ({
  UMAMI_READ_RESOURCES: ['stats', 'pageviews', 'metrics', 'events', 'sessions', 'replays', 'active'],
  umamiConfigured: () => true,
  readUmamiWebsite: readMock,
  createUmamiWebsite: vi.fn(),
  ensureUmamiMember: vi.fn(),
  syncUmamiMembers: vi.fn(),
  umamiSignInUrl: vi.fn(),
  umamiTrackingTags: vi.fn(),
}));

import { handleUxAnalyticsRoutes } from '../../src/routes/ux-analytics';

const WS = '11111111-1111-4111-8111-111111111111';

function call(path: string, method = 'GET') {
  const out = { status: 0, body: '' };
  const res = {
    writeHead: (status: number) => {
      out.status = status;
    },
    end: (body?: string) => {
      out.body = body ?? '';
    },
  } as never;
  return handleUxAnalyticsRoutes({ method, headers: {} } as never, res, new URL(`http://octo.test${path}`)).then(
    (handled) => ({ handled, ...out })
  );
}

describe('UX analytics reads (#445)', () => {
  beforeEach(() => {
    state.member = true;
    state.websiteId = 'site-1';
    state.keyWorkspace = null;
    readMock.mockReset();
    readMock.mockResolvedValue({ pageviews: 3 });
  });

  it("reads the workspace's own website and passes the query through", async () => {
    const result = await call(`/api/workspaces/${WS}/ux-analytics/read/stats?startAt=1&endAt=2&website=other`);
    expect(result.status).toBe(200);
    expect(readMock.mock.calls[0]?.[0]).toBe('site-1');
    expect(readMock.mock.calls[0]?.[1]).toBe('stats');
    expect(JSON.parse(result.body)).toEqual({ pageviews: 3 });
  });

  it('does not route resources outside the allow-list', async () => {
    for (const resource of ['websites', 'teams', 'users', 'stats/extra', '../stats']) {
      expect((await call(`/api/workspaces/${WS}/ux-analytics/read/${resource}`)).handled).toBe(false);
    }
    expect(readMock).not.toHaveBeenCalled();
  });

  it('refuses a non-member and a key bound to another workspace', async () => {
    state.member = false;
    expect((await call(`/api/workspaces/${WS}/ux-analytics/read/events`)).status).toBe(403);
    state.member = true;
    state.keyWorkspace = '22222222-2222-4222-8222-222222222222';
    expect((await call(`/api/workspaces/${WS}/ux-analytics/read/events`)).status).toBe(403);
    expect(readMock).not.toHaveBeenCalled();
  });

  it('says so when UX analytics is not on yet', async () => {
    state.websiteId = null;
    const result = await call(`/api/workspaces/${WS}/ux-analytics/read/sessions`);
    expect(result.status).toBe(404);
    expect(result.body).toContain('UX_ANALYTICS_OFF');
  });

  it('only reads with GET', async () => {
    expect((await call(`/api/workspaces/${WS}/ux-analytics/read/stats`, 'POST')).handled).toBe(false);
  });
});
