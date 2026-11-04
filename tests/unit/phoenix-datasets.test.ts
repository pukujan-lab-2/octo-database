/**
 * Phoenix datasets and experiments through a workspace's otel routes (#47).
 *
 * Phoenix's datasets, versions, experiments and runs are global, so the routes must
 * let a workspace touch only the ones it created. A fake Phoenix holds two
 * workspaces' data; the tests drive workspace A and check it can never reach B's.
 */

import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WS_A = '11111111-1111-4111-8111-111111111111';
const WS_B = '22222222-2222-4222-8222-222222222222';

const state = vi.hoisted(() => ({
  member: true as boolean,
  keyWorkspace: null as string | null,
  /** `${workspace}|${kind}|${id}` for every recorded resource. */
  registry: new Set<string>(),
}));

vi.mock('../../src/server/auth-context', () => ({
  authenticateRequest: vi.fn(async () => ({ principal: { id: 'p1', isPlatformOwner: false }, scopes: ['read', 'write'] })),
  requireScope: vi.fn(() => true),
  scopeDenied: vi.fn(),
  keyWorkspaceMatches: vi.fn((_auth: unknown, id: string) => state.keyWorkspace === null || state.keyWorkspace === id),
}));
vi.mock('../../src/server/db', () => ({
  dbGetWorkspaceMembership: vi.fn(async () => (state.member ? { role: 'member' } : null)),
  dbGetWorkspaceById: vi.fn(async (id: string) => ({ id, slug: id === WS_A ? 'ws-a' : 'ws-b' })),
  dbRecordPhoenixResources: vi.fn(async (ws: string, rows: Array<{ kind: string; id: string }>) => {
    for (const row of rows) state.registry.add(`${ws}|${row.kind}|${row.id}`);
  }),
  dbPhoenixResourceOwned: vi.fn(async (ws: string, kind: string, id: string) => state.registry.has(`${ws}|${kind}|${id}`)),
  dbListPhoenixResourceIds: vi.fn(async (ws: string, kind: string) =>
    Array.from(state.registry)
      .filter((key) => key.startsWith(`${ws}|${kind}|`))
      .map((key) => key.split('|')[2]!)
  ),
}));

import { handlePhoenixDatasetRoutes } from '../../src/routes/phoenix-datasets';

const fetchMock = vi.fn();

function call(path: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) {
  const payload = body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))];
  const req = Object.assign(Readable.from(payload), {
    method,
    url: path,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
  }) as never;
  const out = { status: 0, body: '', headers: {} as Record<string, string> };
  const res = {
    writeHead: (status: number, head?: Record<string, string>) => {
      out.status = status;
      out.headers = head ?? {};
    },
    end: (text?: string) => {
      out.body = text ?? '';
    },
  } as never;
  return handlePhoenixDatasetRoutes(req, res, new URL(`http://octo.test${path}`)).then((handled) => ({
    handled,
    ...out,
    json: () => JSON.parse(out.body) as Record<string, unknown>,
  }));
}

const base = (ws: string) => `/api/workspaces/${ws}/otel`;
const upstreamCalls = () => fetchMock.mock.calls.map((c) => ({ url: String(c[0]), init: c[1] as RequestInit | undefined }));
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

/** Workspace A and B each own a dataset, a version, an example, an experiment and a run. */
function seedBoth() {
  for (const [ws, tag] of [
    [WS_A, 'a'],
    [WS_B, 'b'],
  ] as const) {
    state.registry.add(`${ws}|dataset|ds-${tag}`);
    state.registry.add(`${ws}|version|ver-${tag}`);
    state.registry.add(`${ws}|example|ex-${tag}`);
    state.registry.add(`${ws}|experiment|exp-${tag}`);
    state.registry.add(`${ws}|run|run-${tag}`);
  }
}

describe('phoenix dataset routes (#47)', () => {
  beforeEach(() => {
    state.member = true;
    state.keyWorkspace = null;
    state.registry.clear();
    process.env['OCTO_PHOENIX_URL'] = 'http://phoenix.test';
    process.env['OCTO_PHOENIX_SECRET'] = 'phoenix-secret';
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(reply({ data: {} }));
    vi.stubGlobal('fetch', fetchMock);
  });

  describe('access', () => {
    it('refuses a non-member and a key bound to another workspace, calling Phoenix for neither', async () => {
      state.member = false;
      expect((await call(`${base(WS_A)}/v1/datasets`)).status).toBe(403);
      state.member = true;
      state.keyWorkspace = WS_B;
      expect((await call(`${base(WS_A)}/v1/datasets`)).status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not handle routes outside the allow-list', async () => {
      const closed: Array<[string, string]> = [
        ['DELETE', 'v1/datasets/ds-a'],
        ['GET', 'v1/prompts'],
        ['GET', 'v1/users'],
        ['POST', 'v1/projects'],
        ['GET', 'v1/datasets/ds-a/labels'],
        ['GET', 'v1/experiments/exp-a/tags'],
        ['GET', 'v1/datasets/ds-a/splits'],
        ['DELETE', 'v1/experiments/exp-a'],
      ];
      for (const [method, path] of closed) {
        expect((await call(`${base(WS_A)}/${path}`, method)).handled, `${method} ${path}`).toBe(false);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the Phoenix secret upstream and never back to the caller', async () => {
      seedBoth();
      fetchMock.mockResolvedValue(reply({ data: { id: 'ds-a', name: `${WS_A}/cases` } }));
      const result = await call(`${base(WS_A)}/v1/datasets/ds-a`);
      expect((upstreamCalls()[0]!.init!.headers as Record<string, string>)['authorization']).toBe('Bearer phoenix-secret');
      expect(result.body).not.toContain('phoenix-secret');
    });
  });

  describe('datasets', () => {
    it('prefixes the name, forces sync, and records the dataset and version Phoenix returns', async () => {
      fetchMock.mockResolvedValue(reply({ data: { dataset_id: 'ds-new', version_id: 'ver-new' } }));
      const result = await call(`${base(WS_A)}/v1/datasets/upload?sync=false`, 'POST', {
        action: 'create',
        name: 'cases',
        inputs: [{ q: 1 }],
        outputs: [{ a: 1 }],
      });
      expect(result.status).toBe(200);
      const [sent] = upstreamCalls();
      expect(sent!.url).toBe('http://phoenix.test/v1/datasets/upload?sync=true');
      expect(JSON.parse(String(sent!.init!.body))).toMatchObject({ name: `${WS_A}/cases`, action: 'create' });
      expect(state.registry.has(`${WS_A}|dataset|ds-new`)).toBe(true);
      expect(state.registry.has(`${WS_A}|version|ver-new`)).toBe(true);
    });

    it('lets two workspaces use the same dataset name without sharing it', async () => {
      fetchMock.mockImplementation(async () => reply({ data: { dataset_id: 'x', version_id: 'y' } }));
      await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', { action: 'create', name: 'cases', inputs: [], outputs: [] });
      await call(`${base(WS_B)}/v1/datasets/upload`, 'POST', { action: 'create', name: 'cases', inputs: [], outputs: [] });
      const names = upstreamCalls().map((c) => JSON.parse(String(c.init!.body)).name);
      expect(names).toEqual([`${WS_A}/cases`, `${WS_B}/cases`]);
    });

    it('refuses an upload that is not a create or append of a named dataset, or not JSON', async () => {
      expect((await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', { action: 'delete', name: 'x' })).status).toBe(400);
      expect((await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', { action: 'create' })).status).toBe(400);
      expect((await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', 'not json')).status).toBe(400);
      const multipart = await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', 'x', { 'content-type': 'multipart/form-data' });
      expect(multipart.status).toBe(415);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses an upload that would pull in spans or other untracked fields', async () => {
      const result = await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', {
        action: 'create',
        name: 'from-spans',
        inputs: [],
        outputs: [],
        span_ids: ['span-from-another-workspace'],
      });
      expect(result.status).toBe(400);
      expect((await call(`${base(WS_A)}/v1/datasets/upload`, 'POST', { action: 'create', name: 'x', splits: ['s'] })).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses another workspace's version on a dataset read, and passes its own", async () => {
      seedBoth();
      expect((await call(`${base(WS_A)}/v1/datasets/ds-a/examples?version_id=ver-b`)).status).toBe(404);
      expect((await call(`${base(WS_A)}/v1/datasets/ds-a/csv?version_id=ver-b`)).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockImplementation(async () => reply({ data: { dataset_id: 'ds-a', version_id: 'ver-a', examples: [] } }));
      expect((await call(`${base(WS_A)}/v1/datasets/ds-a/examples?version_id=ver-a`)).status).toBe(200);
    });

    it('remembers the example and version ids it reads, so a later run may name them', async () => {
      seedBoth();
      fetchMock.mockImplementation(async (target: unknown) =>
        String(target).endsWith('/examples')
          ? reply({ data: { dataset_id: 'ds-a', version_id: 'ver-2', examples: [{ id: 'ex-1' }, { id: 'ex-2' }] } })
          : reply({ data: [{ version_id: 'ver-3' }] })
      );
      await call(`${base(WS_A)}/v1/datasets/ds-a/examples`);
      await call(`${base(WS_A)}/v1/datasets/ds-a/versions`);
      for (const key of ['version|ver-2', 'example|ex-1', 'example|ex-2', 'version|ver-3']) {
        expect(state.registry.has(`${WS_A}|${key}`), key).toBe(true);
        expect(state.registry.has(`${WS_B}|${key}`), key).toBe(false);
      }
    });

    it('reads its own dataset with the prefix removed', async () => {
      seedBoth();
      fetchMock.mockResolvedValue(reply({ data: { id: 'ds-a', name: `${WS_A}/cases`, example_count: 3 } }));
      const result = await call(`${base(WS_A)}/v1/datasets/ds-a`);
      expect(result.status).toBe(200);
      expect(result.json()).toEqual({ data: { id: 'ds-a', name: 'cases', example_count: 3 } });
    });

    it("answers 404 for another workspace's dataset id and never asks Phoenix", async () => {
      seedBoth();
      for (const path of ['v1/datasets/ds-b', 'v1/datasets/ds-b/examples', 'v1/datasets/ds-b/versions', 'v1/datasets/ds-b/csv']) {
        expect((await call(`${base(WS_A)}/${path}`)).status, path).toBe(404);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses ids that are not plain Phoenix ids', async () => {
      seedBoth();
      for (const id of ['..%2Fprojects', 'ds-a%00']) {
        expect((await call(`${base(WS_A)}/v1/datasets/${id}`)).status, id).toBe(404);
      }
      // The URL parser turns %2e%2e into `..` and drops the segment, so no route matches.
      expect((await call(`${base(WS_A)}/v1/datasets/%2e%2e`)).handled).toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("lists only this workspace's datasets, strips the prefix, and leaks no cursor", async () => {
      seedBoth();
      fetchMock.mockResolvedValue(
        reply({
          data: [
            { id: 'ds-b', name: `${WS_B}/secret` },
            { id: 'ds-a', name: `${WS_A}/cases` },
            { id: 'ds-other', name: 'made-in-phoenix-ui' },
          ],
          next_cursor: 'cursor-into-b',
        })
      );
      const result = await call(`${base(WS_A)}/v1/datasets`);
      expect(result.json()).toEqual({ data: [{ id: 'ds-a', name: 'cases' }], next_cursor: null });
      expect(result.body).not.toContain('secret');
      expect(result.body).not.toContain('cursor-into-b');
    });

    it('does not call Phoenix to list when the workspace has no datasets', async () => {
      const result = await call(`${base(WS_A)}/v1/datasets`);
      expect(result.json()).toEqual({ data: [], next_cursor: null });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('experiments and runs', () => {
    it('creates an experiment on its own dataset and records it', async () => {
      seedBoth();
      fetchMock.mockResolvedValue(reply({ data: { id: 'exp-new', dataset_id: 'ds-a' } }));
      const result = await call(`${base(WS_A)}/v1/datasets/ds-a/experiments`, 'POST', { version_id: 'ver-a', name: 'run 1' });
      expect(result.status).toBe(200);
      expect(upstreamCalls()[0]!.url).toBe('http://phoenix.test/v1/datasets/ds-a/experiments');
      expect(state.registry.has(`${WS_A}|experiment|exp-new`)).toBe(true);
    });

    it("refuses an experiment on another workspace's dataset or version", async () => {
      seedBoth();
      expect((await call(`${base(WS_A)}/v1/datasets/ds-b/experiments`, 'POST', {})).status).toBe(404);
      // Own dataset, but B's version: it would read B's examples through the experiment.
      expect((await call(`${base(WS_A)}/v1/datasets/ds-a/experiments`, 'POST', { version_id: 'ver-b' })).status).toBe(404);
      expect((await call(`${base(WS_A)}/v1/datasets/ds-a/experiments`, 'POST', { version_id: 7 })).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("answers 404 for another workspace's experiment on every experiment route", async () => {
      seedBoth();
      const paths: Array<[string, string, unknown?]> = [
        ['GET', 'v1/experiments/exp-b'],
        ['GET', 'v1/experiments/exp-b/json'],
        ['GET', 'v1/experiments/exp-b/csv'],
        ['GET', 'v1/experiments/exp-b/runs'],
        ['POST', 'v1/experiments/exp-b/runs', {}],
      ];
      for (const [method, path, body] of paths) {
        expect((await call(`${base(WS_A)}/${path}`, method, body)).status, `${method} ${path}`).toBe(404);
      }
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('records a run, then accepts an evaluation of that run', async () => {
      seedBoth();
      fetchMock.mockResolvedValue(reply({ data: { id: 'run-new' } }));
      await call(`${base(WS_A)}/v1/experiments/exp-a/runs`, 'POST', { dataset_example_id: 'ex-a', output: 'x' });
      expect(state.registry.has(`${WS_A}|run|run-new`)).toBe(true);

      fetchMock.mockResolvedValue(reply({ data: { id: 'eval-1' } }));
      const result = await call(`${base(WS_A)}/v1/experiment_evaluations`, 'POST', {
        experiment_run_id: 'run-new',
        name: 'correct',
        annotator_kind: 'CODE',
      });
      expect(result.status).toBe(200);
      expect(upstreamCalls().at(-1)!.url).toBe('http://phoenix.test/v1/experiment_evaluations');
    });

    it("refuses a run that names another workspace's example, or none", async () => {
      seedBoth();
      // B's example would appear in this experiment's json export.
      expect((await call(`${base(WS_A)}/v1/experiments/exp-a/runs`, 'POST', { dataset_example_id: 'ex-b' })).status).toBe(404);
      expect((await call(`${base(WS_A)}/v1/experiments/exp-a/runs`, 'POST', { output: 'x' })).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses an evaluation of another workspace's run, or of none", async () => {
      seedBoth();
      expect((await call(`${base(WS_A)}/v1/experiment_evaluations`, 'POST', { experiment_run_id: 'run-b' })).status).toBe(404);
      expect((await call(`${base(WS_A)}/v1/experiment_evaluations`, 'POST', { name: 'x' })).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not record anything when Phoenix refuses the create', async () => {
      seedBoth();
      fetchMock.mockResolvedValue(reply({ detail: 'bad' }, 422));
      const result = await call(`${base(WS_A)}/v1/experiments/exp-a/runs`, 'POST', { dataset_example_id: 'ex-a' });
      expect(result.status).toBe(422);
      expect(state.registry.size).toBe(10);
    });
  });

  describe('projects', () => {
    it("lists only this workspace's project, never Phoenix's whole list", async () => {
      fetchMock.mockResolvedValue(reply({ data: { id: 'p1', name: 'ws-a' } }));
      const result = await call(`${base(WS_A)}/v1/projects`);
      expect(upstreamCalls()[0]!.url).toBe('http://phoenix.test/v1/projects/ws-a');
      expect(result.json()).toEqual({ data: [{ id: 'p1', name: 'ws-a' }], next_cursor: null });
    });

    it('answers an empty list for a project Phoenix has not created yet', async () => {
      fetchMock.mockResolvedValue(reply({ detail: 'nope' }, 404));
      expect((await call(`${base(WS_A)}/v1/projects`)).json()).toEqual({ data: [], next_cursor: null });
    });

    it("answers 404 for any project but the workspace's own", async () => {
      expect((await call(`${base(WS_A)}/v1/projects/ws-b`)).status).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
      fetchMock.mockResolvedValue(reply({ data: { id: 'p1', name: 'ws-a' } }));
      expect((await call(`${base(WS_A)}/v1/projects/ws-a`)).status).toBe(200);
    });
  });

  it('answers 502 when Phoenix cannot be reached', async () => {
    seedBoth();
    fetchMock.mockRejectedValue(new Error('connect refused'));
    expect((await call(`${base(WS_A)}/v1/datasets/ds-a`)).status).toBe(502);
  });
});
