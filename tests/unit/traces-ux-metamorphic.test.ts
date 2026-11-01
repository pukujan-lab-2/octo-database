/**
 * Metamorphic tests for the trace, UX analytics and viewer-cookie surfaces (#442, #445).
 *
 * Each relation holds over a generated family of inputs, so a single counterexample
 * fails the suite:
 *
 *   MR-T1  Project fence: whatever the caller puts in the query, Phoenix is asked for
 *          the workspace's own project, and swapping the workspace swaps only the slug.
 *   MR-T2  Query order does not change what Phoenix is asked.
 *   MR-T3  Allow-list closure: no mutation of an allowed resource name is routed, and
 *          nothing outside the list is.
 *   MR-T4  Website fence: Umami is asked for the workspace's own website whatever the query.
 *   MR-T5  Allow-list closure for UX analytics.
 *   MR-T6  Viewer cookie: no one-character change verifies, it never verifies for another
 *          principal, and it is valid exactly until it expires.
 *   MR-T7  Tool scope monotonicity: a key with more scopes sees at least the tools a key
 *          with fewer sees, and each new tool needs the scope its route needs.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ slug: 'ws-one', websiteId: 'site-1' }));
const readMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/server/auth-context', () => ({
  authenticateRequest: vi.fn(async () => ({ principal: { id: 'p1', email: 'a@b.c', isPlatformOwner: false }, scopes: ['read'] })),
  requireScope: vi.fn(() => true),
  scopeDenied: vi.fn(),
  roleAllows: vi.fn(() => true),
  keyWorkspaceMatches: vi.fn(() => true),
}));
vi.mock('../../src/server/db', () => ({
  dbGetWorkspaceMembership: vi.fn(async () => ({ role: 'member' })),
  dbGetWorkspaceById: vi.fn(async () => ({ id: 'w', slug: state.slug, name: 'S' })),
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

import { capabilitiesForScopes, OCTO_CAPABILITIES } from '../../src/api/capabilities';
import { signViewerToken, verifyViewerToken } from '../../src/lib/session-token';
import { TOOL_ACTIONS } from '../../src/mcp/server';
import { handleTracesRoutes } from '../../src/routes/traces';
import { handleUxAnalyticsRoutes } from '../../src/routes/ux-analytics';

/** Deterministic PRNG so a failing case reproduces from the seed alone. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WS = '11111111-1111-4111-8111-111111111111';
const TRACE_RESOURCES = ['spans', 'traces', 'sessions', 'span_annotations', 'trace_annotations', 'session_annotations', 'annotation_configs'];
const UX_RESOURCES = ['stats', 'pageviews', 'metrics', 'events', 'sessions', 'replays', 'active'];
const NOISE_KEYS = ['project', 'project_identifier', 'projectId', 'workspaceId', 'slug', 'website', 'websiteId', 'teamId', 'limit', 'cursor', 'status_code', 'name', 'span_ids', 'startAt', 'endAt'];
const NOISE_VALUES = ['other', '../x', '%2e%2e', 'ws-two', 'site-9', '1', 'a b', 'a&b=c', '', '😀', '//evil'];

function randomQuery(rand: () => number): Array<[string, string]> {
  const count = Math.floor(rand() * 6);
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < count; i += 1) {
    pairs.push([NOISE_KEYS[Math.floor(rand() * NOISE_KEYS.length)]!, NOISE_VALUES[Math.floor(rand() * NOISE_VALUES.length)]!]);
  }
  return pairs;
}

function search(pairs: Array<[string, string]>): string {
  return pairs.length ? `?${new URLSearchParams(pairs).toString()}` : '';
}

async function route(handler: typeof handleTracesRoutes, path: string, method = 'GET') {
  const out = { handled: false };
  const res = { writeHead: () => undefined, end: () => undefined } as never;
  out.handled = await handler({ method, headers: {} } as never, res, new URL(`http://octo.test${path}`));
  return out.handled;
}

const fetchMock = vi.fn();

beforeEach(() => {
  state.slug = 'ws-one';
  state.websiteId = 'site-1';
  process.env['OCTO_PHOENIX_URL'] = 'http://phoenix.test';
  process.env['OCTO_PHOENIX_SECRET'] = 'secret';
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response('{"data":[],"next_cursor":null}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  readMock.mockReset();
  readMock.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MR-T1/T2: trace reads are fenced to the workspace project', () => {
  it('asks Phoenix for the workspace slug whatever the query holds, and swapping the workspace swaps only the slug', async () => {
    const rand = makeRandom(4201);
    for (let i = 0; i < 200; i += 1) {
      const resource = TRACE_RESOURCES[Math.floor(rand() * TRACE_RESOURCES.length)]!;
      const query = randomQuery(rand);
      const urls: string[] = [];
      for (const slug of ['ws-one', 'ws-two']) {
        state.slug = slug;
        fetchMock.mockClear();
        await route(handleTracesRoutes, `/api/workspaces/${WS}/otel/read/${resource}${search(query)}`);
        urls.push(String(fetchMock.mock.calls[0]?.[0]));
      }
      const [one, two] = urls as [string, string];
      expect(new URL(one).pathname).toBe(`/v1/projects/ws-one/${resource}`);
      expect(new URL(two).pathname).toBe(`/v1/projects/ws-two/${resource}`);
      expect(new URL(one).origin).toBe('http://phoenix.test');
      expect(one.replace('/ws-one/', '/ws-two/')).toBe(two);
    }
  });

  it('asks the same question however the query is ordered', async () => {
    const rand = makeRandom(4202);
    for (let i = 0; i < 100; i += 1) {
      const query = randomQuery(rand);
      const shuffled = [...query].sort(() => rand() - 0.5);
      const asked: string[][] = [];
      for (const pairs of [query, shuffled]) {
        fetchMock.mockClear();
        await route(handleTracesRoutes, `/api/workspaces/${WS}/otel/read/spans${search(pairs)}`);
        asked.push(Array.from(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.entries()).map(([k, v]) => `${k}=${v}`).sort());
      }
      expect(asked[1]).toEqual(asked[0]);
    }
  });
});

describe('MR-T3/T5: only the listed resources are routed', () => {
  const mutate = (name: string): string[] => [
    name.toUpperCase(),
    `${name}/x`,
    `x${name}`,
    `${name}%2f..%2fdatasets`,
    `${name}%00`,
    `../${name}`,
    `${name}/../../datasets`,
    `${name}s`,
    ` ${name}`,
  ];
  const outside = ['datasets', 'experiments', 'prompts', 'projects', 'users', 'teams', 'websites', 'spans/abc', 'v1/spans', 'graphql', ''];

  it('routes no mutation of a trace resource and nothing outside the list', async () => {
    for (const resource of [...TRACE_RESOURCES.flatMap(mutate), ...outside]) {
      expect(await route(handleTracesRoutes, `/api/workspaces/${WS}/otel/read/${resource}`)).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    for (const resource of TRACE_RESOURCES) {
      expect(await route(handleTracesRoutes, `/api/workspaces/${WS}/otel/read/${resource}`)).toBe(true);
    }
  });

  it('routes no mutation of a UX resource and nothing outside the list', async () => {
    for (const resource of [...UX_RESOURCES.flatMap(mutate), ...outside]) {
      expect(await route(handleUxAnalyticsRoutes, `/api/workspaces/${WS}/ux-analytics/read/${resource}`)).toBe(false);
    }
    expect(readMock).not.toHaveBeenCalled();
    for (const resource of UX_RESOURCES) {
      expect(await route(handleUxAnalyticsRoutes, `/api/workspaces/${WS}/ux-analytics/read/${resource}`)).toBe(true);
    }
  });
});

describe('MR-T4: UX reads are fenced to the workspace website', () => {
  it('asks Umami for the workspace website whatever the query holds', async () => {
    const rand = makeRandom(4204);
    for (let i = 0; i < 150; i += 1) {
      const resource = UX_RESOURCES[Math.floor(rand() * UX_RESOURCES.length)]!;
      state.websiteId = i % 2 ? 'site-1' : 'site-2';
      readMock.mockClear();
      await route(handleUxAnalyticsRoutes, `/api/workspaces/${WS}/ux-analytics/read/${resource}${search(randomQuery(rand))}`);
      expect(readMock.mock.calls[0]?.[0]).toBe(state.websiteId);
      expect(readMock.mock.calls[0]?.[1]).toBe(resource);
    }
  });
});

describe('MR-T6: the viewer cookie', () => {
  const ME = '11111111-1111-4111-8111-111111111111';
  const OTHER = '22222222-2222-4222-8222-222222222222';
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  it('is rejected after any one-character change', () => {
    const token = signViewerToken(ME);
    const rand = makeRandom(4206);
    for (let i = 0; i < token.length; i += 1) {
      const original = token[i]!;
      let replacement = ALPHABET[Math.floor(rand() * ALPHABET.length)]!;
      if (replacement === original) replacement = replacement === 'A' ? 'B' : 'A';
      const changed = token.slice(0, i) + replacement + token.slice(i + 1);
      expect(verifyViewerToken(changed), `position ${i}`).toBeNull();
    }
  });

  it('never verifies for another principal', () => {
    const [, exp, sig] = signViewerToken(ME).split('.') as [string, string, string];
    expect(verifyViewerToken(`${OTHER}.${exp}.${sig}`)).toBeNull();
    expect(verifyViewerToken(signViewerToken(ME))).toBe(ME);
    expect(verifyViewerToken(signViewerToken(OTHER))).toBe(OTHER);
  });

  it('is valid until it expires and not after', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    for (const ttl of [1, 60, 3600, 28800]) {
      const token = signViewerToken(ME, ttl);
      vi.setSystemTime(new Date(Date.now() + (ttl - 1) * 1000));
      expect(verifyViewerToken(token), `ttl ${ttl} just before`).toBe(ME);
      vi.setSystemTime(new Date(Date.now() + 1000));
      expect(verifyViewerToken(token), `ttl ${ttl} at expiry`).toBeNull();
      vi.setSystemTime(new Date('2026-11-01T00:00:00Z'));
    }
  });
});

describe('MR-T7: tools follow scopes monotonically', () => {
  const SCOPES = ['read', 'write', 'delete', 'files'];
  const visible = (scopes: string[]) => {
    const actions = new Set(capabilitiesForScopes(scopes).map((c) => c.action));
    return Object.entries(TOOL_ACTIONS)
      .filter(([, action]) => actions.has(action))
      .map(([tool]) => tool);
  };
  const subsets = (): string[][] =>
    Array.from({ length: 1 << SCOPES.length }, (_, mask) => SCOPES.filter((_, bit) => mask & (1 << bit)));

  it('shows a key with more scopes at least the tools a key with fewer scopes sees', () => {
    for (const a of subsets()) {
      for (const b of subsets()) {
        if (!a.every((scope) => b.includes(scope))) continue;
        const bigger = new Set(visible(b));
        for (const tool of visible(a)) expect(bigger.has(tool), `${tool}: ${a} within ${b}`).toBe(true);
      }
    }
  });

  it('gives every tool a capability that exists', () => {
    const known = new Set(OCTO_CAPABILITIES.map((c) => c.action));
    for (const [tool, action] of Object.entries(TOOL_ACTIONS)) expect(known.has(action), `${tool} -> ${action}`).toBe(true);
  });

  it('lets a read-only key read traces and UX data but not score spans or turn UX analytics on', () => {
    const readOnly = visible(['read']);
    for (const tool of ['read_traces', 'get_trace_link', 'get_ux_analytics', 'read_ux_analytics']) expect(readOnly).toContain(tool);
    for (const tool of ['record_eval_scores', 'enable_ux_analytics']) expect(readOnly).not.toContain(tool);
    const writeOnly = visible(['write']);
    for (const tool of ['record_eval_scores', 'enable_ux_analytics']) expect(writeOnly).toContain(tool);
    for (const tool of ['read_traces', 'read_ux_analytics']) expect(writeOnly).not.toContain(tool);
  });
});
