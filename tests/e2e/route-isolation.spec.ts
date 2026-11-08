/**
 * Playwright E2E: tenant isolation over every route and MCP tool (#419).
 *
 * The cases are generated from tests/e2e/route-table.ts, so a new route is
 * covered as soon as it has a row (the drift test in tests/unit makes sure it
 * does). Two guests each own a workspace. Against Alice's workspace:
 *
 * - no credential is refused (401);
 * - Alice's revoked key is refused (401);
 * - Bob's key, pinned to his own workspace, is refused (403);
 * - Bob's own session, as a non-member, is refused (403);
 * - Alice's read-only key is refused on every route that needs more (403);
 * - the vault refuses every API key (403).
 *
 * The MCP half calls every tool that takes a workspaceId with Alice's workspace
 * while holding Bob's credentials, and checks the tool list a read-only key sees.
 */

import { expect, test, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { CONFIRM_SECRET, setConfirmSecret } from './confirm-secret';
import { ROUTE_TABLE, RouteSpec, concretePath } from './route-table';
import { TOOL_ACTIONS } from '../../src/mcp/server';

interface GuestSession {
  principal: { id: string };
  workspace: { id: string };
  sessionToken: string;
}

interface MintedKey {
  apiKey: { id: string };
  rawSecret: string;
}

const ALL_SCOPES = ['read', 'write', 'files', 'delete'];
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function createGuest(request: APIRequestContext, label: string): Promise<GuestSession> {
  const response = await request.post('/api/auth/guest', {
    data: { displayName: `Isolation ${label} ${randomUUID()}` },
  });
  expect(response.status()).toBe(201);
  const session = (await response.json()) as GuestSession;
  await setConfirmSecret(request, session.sessionToken);
  return session;
}

async function mintKey(
  request: APIRequestContext,
  guest: GuestSession,
  scopes: string[]
): Promise<MintedKey> {
  const response = await request.post('/api/keys', {
    headers: bearer(guest.sessionToken),
    data: { name: `isolation ${randomUUID()}`, workspaceId: guest.workspace.id, scopes, confirmSecret: CONFIRM_SECRET },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as MintedKey;
}

/** Calls a table row against a workspace, filling in what input validation needs. */
function callRoute(request: APIRequestContext, spec: RouteSpec, token: string | null, workspaceId: string) {
  const id = randomUUID();
  const params = new URLSearchParams();
  if (spec.ws === 'query') params.set('workspaceId', workspaceId);
  for (const [key, value] of Object.entries(spec.query ?? {})) params.set(key, value === ':id' ? id : value);
  const search = params.size > 0 ? `?${params}` : '';
  const data = {
    ...spec.body,
    ...(spec.ws === 'body' ? { workspaceId } : {}),
    ...(spec.confirm ? { confirmSecret: CONFIRM_SECRET } : {}),
  };
  return request.fetch(`${concretePath(spec, workspaceId, id)}${search}`, {
    method: spec.method,
    headers: token ? bearer(token) : {},
    ...(spec.method === 'GET' ? {} : { data }),
    maxRedirects: 0,
  });
}

const label = (spec: RouteSpec) => `${spec.method} ${spec.path}`;
const guarded = ROUTE_TABLE.filter((spec) => spec.tenancy !== 'public' && spec.tenancy !== 'token');
const workspaceRoutes = ROUTE_TABLE.filter((spec) => spec.tenancy === 'workspace');
const vaultRoutes = ROUTE_TABLE.filter((spec) => spec.tenancy === 'session');
// A read-only key may pass a read route; everything else must refuse it. A
// confirm-gated route refuses every API key, whatever its scope.
const needsMoreThanRead = workspaceRoutes.filter((spec) => spec.scope !== 'read' || spec.confirm);

let alice: GuestSession;
let bob: GuestSession;
let aliceReadKey: MintedKey;
let aliceRevokedKey: MintedKey;
let bobKey: MintedKey;

test.describe('Route isolation', () => {
  test.beforeAll(async ({ request }) => {
    alice = await createGuest(request, 'alice');
    bob = await createGuest(request, 'bob');
    aliceReadKey = await mintKey(request, alice, ['read']);
    aliceRevokedKey = await mintKey(request, alice, ALL_SCOPES);
    bobKey = await mintKey(request, bob, ALL_SCOPES);
    const revoke = await request.delete(`/api/keys/${aliceRevokedKey.apiKey.id}`, {
      headers: bearer(alice.sessionToken),
    });
    expect(revoke.status()).toBe(200);
  });

  test('every table row is a live route', async ({ request }) => {
    const missing: string[] = [];
    for (const spec of ROUTE_TABLE) {
      const response = await callRoute(request, spec, null, alice.workspace.id);
      const body = await response.text();
      if (response.status() === 404 && body.includes('Not found: ')) missing.push(label(spec));
    }
    expect(missing).toEqual([]);
  });

  for (const spec of guarded) {
    test(`${label(spec)}: no credential is refused`, async ({ request }) => {
      expect((await callRoute(request, spec, null, alice.workspace.id)).status()).toBe(401);
    });

    test(`${label(spec)}: a revoked key is refused`, async ({ request }) => {
      expect((await callRoute(request, spec, aliceRevokedKey.rawSecret, alice.workspace.id)).status()).toBe(401);
    });
  }

  for (const spec of workspaceRoutes) {
    test(`${label(spec)}: another workspace's key is refused`, async ({ request }) => {
      expect((await callRoute(request, spec, bobKey.rawSecret, alice.workspace.id)).status()).toBe(403);
    });

    test(`${label(spec)}: a non-member's session is refused`, async ({ request }) => {
      const response = await callRoute(request, spec, bob.sessionToken, alice.workspace.id);
      if (spec.hiddenFromNonMembers) {
        expect(response.status()).toBe(404);
        expect(await response.text()).toContain('WORKSPACE_NOT_FOUND');
      } else {
        expect(response.status()).toBe(403);
      }
    });
  }

  for (const spec of needsMoreThanRead) {
    test(`${label(spec)}: a read-only key is refused`, async ({ request }) => {
      expect((await callRoute(request, spec, aliceReadKey.rawSecret, alice.workspace.id)).status()).toBe(403);
    });
  }

  for (const spec of vaultRoutes) {
    test(`${label(spec)}: an API key is refused`, async ({ request }) => {
      expect((await callRoute(request, spec, aliceReadKey.rawSecret, alice.workspace.id)).status()).toBe(403);
    });
  }

  test("another person cannot see, re-scope or revoke someone's key", async ({ request }) => {
    const keyId = aliceReadKey.apiKey.id;
    const listed = (await (await request.get('/api/keys', { headers: bearer(bob.sessionToken) })).json()) as Array<{
      id: string;
    }>;
    expect(listed.map((key) => key.id)).not.toContain(keyId);

    const patch = await request.patch(`/api/keys/${keyId}`, {
      headers: bearer(bob.sessionToken),
      data: { scopes: ALL_SCOPES, confirmSecret: CONFIRM_SECRET },
    });
    expect(patch.status()).toBe(404);
    const revoke = await request.delete(`/api/keys/${keyId}`, { headers: bearer(bob.sessionToken) });
    expect(revoke.status()).toBe(404);

    const me = await request.get('/api/capabilities', { headers: bearer(aliceReadKey.rawSecret) });
    expect(me.status()).toBe(200);
  });
});

// MCP

interface JsonSchema {
  type?: string;
  enum?: unknown[];
  format?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
}

interface ToolInfo {
  name: string;
  inputSchema: JsonSchema;
}

// Optional arguments a tool needs to get past input validation to the API's
// workspace checks (ingest takes either fileId or title and text).
const TOOL_ARGUMENTS: Record<string, Record<string, unknown>> = {
  ingest_document: { title: 'probe', text: 'probe' },
  link_documents: { links: [{ fromDocumentId: randomUUID(), toDocumentId: randomUUID(), relation: 'cites' }] },
  unlink_documents: { relation: 'cites' },
};

const mcpHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  Authorization: `Bearer ${token}`,
});

/** Posts one JSON-RPC call to /mcp and returns its result, whether the reply is JSON or SSE. */
async function mcp(request: APIRequestContext, token: string, method: string, params: Record<string, unknown> = {}) {
  const response = await request.post('/mcp', {
    headers: mcpHeaders(token),
    data: { jsonrpc: '2.0', id: 1, method, params },
  });
  expect(response.status()).toBe(200);
  const text = await response.text();
  const json = text.trimStart().startsWith('{')
    ? text
    : text
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice('data:'.length))
        .join('');
  return (JSON.parse(json) as { result: Record<string, unknown> }).result;
}

/** The smallest value that satisfies one schema property. */
function valueFor(name: string, prop: JsonSchema): unknown {
  if (prop.enum) return prop.enum[0];
  if (prop.type === 'number' || prop.type === 'integer') return 1;
  if (prop.type === 'boolean') return false;
  if (prop.type === 'array') return [];
  if (prop.type === 'object') return requiredFields(prop);
  if (/^asOf|At$/.test(name) || prop.format === 'date-time') return '2026-01-01T00:00:00Z';
  if (/Id$/.test(name)) return randomUUID();
  return 'probe';
}

function requiredFields(schema: JsonSchema): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const name of schema.required ?? []) fields[name] = valueFor(name, schema.properties?.[name] ?? {});
  return fields;
}

/** Arguments that satisfy a tool's input schema, aimed at one workspace. */
function argumentsFor(tool: ToolInfo, workspaceId: string): Record<string, unknown> {
  return { ...requiredFields(tool.inputSchema), ...TOOL_ARGUMENTS[tool.name], workspaceId };
}

/** A refusal: 403, or 404 WORKSPACE_NOT_FOUND where the workspace is invisible to the caller. */
const refused = (text: string) => text.includes('(403)') || (text.includes('(404)') && text.includes('WORKSPACE_NOT_FOUND'));

test.describe('MCP isolation', () => {
  test.beforeAll(async ({ request }) => {
    alice ??= await createGuest(request, 'alice');
    bob ??= await createGuest(request, 'bob');
    aliceReadKey ??= await mintKey(request, alice, ['read']);
    bobKey ??= await mintKey(request, bob, ALL_SCOPES);
  });

  test("every workspace tool refuses another workspace's key and a non-member", async ({ request }) => {
    const { tools } = (await mcp(request, bob.sessionToken, 'tools/list')) as { tools: ToolInfo[] };
    const workspaceTools = tools.filter((tool) => tool.inputSchema.properties?.['workspaceId']);
    expect(workspaceTools.length).toBeGreaterThan(20);

    const leaks: string[] = [];
    for (const token of [bobKey.rawSecret, bob.sessionToken]) {
      for (const tool of workspaceTools) {
        const result = (await mcp(request, token, 'tools/call', {
          name: tool.name,
          arguments: argumentsFor(tool, alice.workspace.id),
        })) as { isError?: boolean; content?: Array<{ text?: string }> };
        const text = result.content?.map((part) => part.text ?? '').join(' ') ?? '';
        if (!result.isError || !refused(text)) leaks.push(`${tool.name}: ${text.slice(0, 160)}`);
      }
    }
    expect(leaks).toEqual([]);
  });

  test('a read-only key sees only the tools its capabilities allow', async ({ request }) => {
    const capabilities = (await (
      await request.get('/api/capabilities', { headers: bearer(aliceReadKey.rawSecret) })
    ).json()) as { capabilities: Array<{ action: string }> };
    const allowed = new Set(capabilities.capabilities.map((capability) => capability.action));

    const { tools } = (await mcp(request, aliceReadKey.rawSecret, 'tools/list')) as { tools: ToolInfo[] };
    const overreach = tools
      .map((tool) => tool.name)
      .filter((name) => TOOL_ACTIONS[name] !== undefined && !allowed.has(TOOL_ACTIONS[name]!));
    expect(overreach).toEqual([]);
    expect(tools.map((tool) => tool.name)).not.toContain('delete_file');
  });

  test('a revoked key cannot reach /mcp', async ({ request }) => {
    const key = await mintKey(request, alice, ALL_SCOPES);
    expect((await request.delete(`/api/keys/${key.apiKey.id}`, { headers: bearer(alice.sessionToken) })).status()).toBe(200);
    const response = await request.post('/mcp', {
      headers: mcpHeaders(key.rawSecret),
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
    });
    expect(response.status()).toBe(401);
  });
});
