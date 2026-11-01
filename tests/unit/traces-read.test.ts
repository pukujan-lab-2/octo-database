import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  slug: 'ws-one',
  member: true as boolean,
  keyWorkspace: null as string | null,
}));

vi.mock('../../src/server/auth-context', () => ({
  authenticateRequest: vi.fn(async () => ({ principal: { id: 'p1', isPlatformOwner: false }, scopes: ['read'] })),
  requireScope: vi.fn(() => true),
  scopeDenied: vi.fn(),
  keyWorkspaceMatches: vi.fn((_auth: unknown, id: string) => state.keyWorkspace === null || state.keyWorkspace === id),
}));
vi.mock('../../src/server/db', () => ({
  dbGetWorkspaceMembership: vi.fn(async () => (state.member ? { role: 'member' } : null)),
  dbGetWorkspaceById: vi.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111', slug: state.slug })),
}));

import { handleTracesRoutes } from '../../src/routes/traces';

const WS = '11111111-1111-4111-8111-111111111111';

function call(path: string, method = 'GET') {
  const req = { method, headers: {}, url: path } as never;
  const out = { status: 0, body: '' };
  const res = {
    writeHead: (status: number) => {
      out.status = status;
    },
    end: (body?: string) => {
      out.body = body ?? '';
    },
  } as never;
  return handleTracesRoutes(req, res, new URL(`http://octo.test${path}`)).then((handled) => ({ handled, ...out }));
}

const fetchMock = vi.fn();

describe('trace reads (#442)', () => {
  beforeEach(() => {
    state.slug = 'ws-one';
    state.member = true;
    state.keyWorkspace = null;
    process.env['OCTO_PHOENIX_URL'] = 'http://phoenix.test';
    process.env['OCTO_PHOENIX_SECRET'] = 'secret';
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response('{"data":[{"id":"s1"}],"next_cursor":null}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  it('reads the workspace slug\'s project and passes the query through', async () => {
    const result = await call(`/api/workspaces/${WS}/otel/read/spans?limit=5&status_code=ERROR`);
    expect(result.status).toBe(200);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://phoenix.test/v1/projects/ws-one/spans?limit=5&status_code=ERROR');
  });

  it('cannot be pointed at another project by the caller', async () => {
    await call(`/api/workspaces/${WS}/otel/read/spans?project=other&project_identifier=other`);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/^http:\/\/phoenix\.test\/v1\/projects\/ws-one\/spans\?/);
  });

  it('does not route resources outside the allow-list', async () => {
    for (const resource of ['datasets', 'experiments', 'prompts', '../spans', 'spans/abc']) {
      const result = await call(`/api/workspaces/${WS}/otel/read/${resource}`);
      expect(result.handled).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a non-member and a key bound to another workspace', async () => {
    state.member = false;
    expect((await call(`/api/workspaces/${WS}/otel/read/traces`)).status).toBe(403);
    state.member = true;
    state.keyWorkspace = '22222222-2222-4222-8222-222222222222';
    expect((await call(`/api/workspaces/${WS}/otel/read/traces`)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers a project Phoenix has not created yet with an empty result', async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"not found"}', { status: 404 }));
    const result = await call(`/api/workspaces/${WS}/otel/read/span_annotations?span_ids=a`);
    expect(result.status).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ data: [], next_cursor: null });
  });

  it('only reads with GET', async () => {
    expect((await call(`/api/workspaces/${WS}/otel/read/spans`, 'POST')).handled).toBe(false);
  });
});
