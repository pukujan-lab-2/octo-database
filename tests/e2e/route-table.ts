/**
 * Every HTTP route Octo serves, with how it is authorized.
 *
 * route-isolation.spec.ts generates its refusal cases from this table, and
 * tests/unit/route-table-drift.test.ts fails when a route in src/routes (or the
 * OAuth routes in src/server/oauth.ts) is missing from it. Add a row when you add
 * a route.
 *
 * Path placeholders: `:ws` is the workspace id, `:id` any other id (a random UUID
 * is enough, because every workspace route checks the caller before it looks the
 * resource up).
 *
 * Tenancy:
 * - `workspace`: the caller must hold a credential for the workspace and be a member.
 * - `principal`: the caller sees only their own data; no workspace in the request.
 * - `session`: a person's session only; every API key is refused (the vault).
 * - `token`: authorized by its own credential (signed media URL, share token,
 *   vault grant or lease), not by a bearer key.
 * - `public`: no credential.
 */

export type Scope = 'read' | 'write' | 'files' | 'delete';

export interface RouteSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  tenancy: 'workspace' | 'principal' | 'session' | 'token' | 'public';
  /** Scope the route requires of an API key; null when it checks none. */
  scope: Scope | null;
  /** Where a workspace route reads the workspace id from. */
  ws?: 'path' | 'query' | 'body';
  /** Extra query parameters needed to get past input validation to the auth checks. */
  query?: Record<string, string>;
  /** Extra JSON body fields, for the same reason. */
  body?: Record<string, unknown>;
  /** The route runs the confirm gate before its membership check. */
  confirm?: boolean;
  /**
   * The route looks the workspace up under row-level security before checking
   * membership, so a non-member gets 404 WORKSPACE_NOT_FOUND: the workspace is
   * invisible to them, which refuses without confirming it exists.
   */
  hiddenFromNonMembers?: boolean;
  /** The file that implements it. */
  source: string;
}

const NOW = '2026-01-01T00:00:00Z';

export const ROUTE_TABLE: RouteSpec[] = [
  // Public
  { method: 'GET', path: '/health', tenancy: 'public', scope: null, source: 'src/routes/health.ts' },
  { method: 'GET', path: '/api/auth/google', tenancy: 'public', scope: null, source: 'src/routes/auth.ts' },
  { method: 'GET', path: '/api/auth/google/callback', tenancy: 'public', scope: null, source: 'src/routes/auth.ts' },
  { method: 'POST', path: '/api/auth/guest', tenancy: 'public', scope: null, source: 'src/routes/auth.ts' },
  { method: 'GET', path: '/.well-known/oauth-protected-resource', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'GET', path: '/.well-known/oauth-protected-resource/mcp', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'GET', path: '/.well-known/oauth-authorization-server', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'POST', path: '/oauth/dance', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'POST', path: '/oauth/register', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'GET', path: '/oauth/authorize', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'POST', path: '/oauth/authorize', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },
  { method: 'POST', path: '/oauth/token', tenancy: 'public', scope: null, source: 'src/server/oauth.ts' },

  // Their own credential
  { method: 'GET', path: '/api/files/content', tenancy: 'token', scope: null, source: 'src/routes/files.ts' },
  { method: 'GET', path: '/api/files/thumbnail', tenancy: 'token', scope: null, source: 'src/routes/files.ts' },
  { method: 'GET', path: '/public/files/:id', tenancy: 'token', scope: null, source: 'src/routes/public-files.ts' },
  { method: 'GET', path: '/api/public/shares/:id', tenancy: 'token', scope: null, source: 'src/routes/shares.ts' },
  { method: 'GET', path: '/api/vault/open', tenancy: 'token', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/open/decoy', tenancy: 'token', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/open/lease', tenancy: 'token', scope: null, source: 'src/routes/vault.ts' },
  { method: 'GET', path: '/api/vault/proxy', tenancy: 'token', scope: null, source: 'src/routes/vault-relay.ts' },
  { method: 'GET', path: '/api/vault/proxy/probe', tenancy: 'token', scope: null, source: 'src/routes/vault-relay.ts' },
  { method: 'POST', path: '/api/vault/lease/renew', tenancy: 'token', scope: null, source: 'src/routes/vault-relay.ts' },
  { method: 'GET', path: '/api/vault/lease/info', tenancy: 'token', scope: null, source: 'src/routes/vault-relay.ts' },
  { method: 'GET', path: '/api/vault/relay/probe', tenancy: 'token', scope: null, source: 'src/routes/vault-relay.ts' },

  // The caller's own account
  { method: 'GET', path: '/api/me', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/confirm-secret', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/confirm-challenge', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'GET', path: '/api/me/mfa', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/mfa/begin', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/mfa/confirm', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/mfa/disable', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'POST', path: '/api/me/mfa/recovery-codes', tenancy: 'principal', scope: null, source: 'src/routes/me.ts' },
  { method: 'GET', path: '/api/keys', tenancy: 'principal', scope: null, source: 'src/routes/keys.ts' },
  { method: 'POST', path: '/api/keys', tenancy: 'principal', scope: null, source: 'src/routes/keys.ts' },
  { method: 'GET', path: '/api/keys/uses', tenancy: 'principal', scope: 'read', source: 'src/routes/keys.ts' },
  { method: 'PATCH', path: '/api/keys/:id', tenancy: 'principal', scope: null, source: 'src/routes/keys.ts' },
  { method: 'DELETE', path: '/api/keys/:id', tenancy: 'principal', scope: 'delete', source: 'src/routes/keys.ts' },
  { method: 'GET', path: '/api/databases', tenancy: 'principal', scope: 'read', source: 'src/routes/workspaces.ts' },
  { method: 'GET', path: '/api/workspaces', tenancy: 'principal', scope: 'read', source: 'src/routes/workspaces.ts' },
  { method: 'POST', path: '/api/workspaces', tenancy: 'principal', scope: 'write', source: 'src/routes/workspaces.ts' },
  { method: 'GET', path: '/api/capabilities', tenancy: 'principal', scope: null, source: 'src/routes/capabilities.ts' },
  { method: 'GET', path: '/api/services', tenancy: 'principal', scope: null, source: 'src/routes/services.ts' },
  { method: 'POST', path: '/mcp', tenancy: 'principal', scope: null, source: 'src/routes/mcp.ts' },

  // The vault: a person's session only
  { method: 'GET', path: '/api/vault/items', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/items', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/items/bulk', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/items/bulk-delete', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'GET', path: '/api/vault/items/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'PATCH', path: '/api/vault/items/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'DELETE', path: '/api/vault/items/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'GET', path: '/api/vault/items/:id/routes', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/items/:id/routes', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'DELETE', path: '/api/vault/items/:id/routes/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'GET', path: '/api/vault/leases', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'DELETE', path: '/api/vault/leases/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'GET', path: '/api/vault/grants', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/grants', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'DELETE', path: '/api/vault/grants/:id', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },
  { method: 'POST', path: '/api/vault/health', tenancy: 'session', scope: null, source: 'src/routes/vault.ts' },

  // Workspaces
  { method: 'DELETE', path: '/api/workspaces/:ws', tenancy: 'workspace', scope: null, ws: 'path', confirm: true, hiddenFromNonMembers: true, source: 'src/routes/workspaces.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/database', tenancy: 'workspace', scope: 'write', ws: 'path', hiddenFromNonMembers: true, source: 'src/routes/workspaces.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/query', tenancy: 'workspace', scope: 'read', ws: 'path', body: { sql: 'select 1' }, source: 'src/routes/workspace-query.ts' },

  // Files
  { method: 'GET', path: '/api/files', tenancy: 'workspace', scope: 'files', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'POST', path: '/api/files/upload', tenancy: 'workspace', scope: 'write', ws: 'body', body: { name: 'probe.txt', data: 'aGk=', dataEncoding: 'base64' }, source: 'src/routes/files.ts' },
  { method: 'GET', path: '/api/files/download', tenancy: 'workspace', scope: 'files', ws: 'query', query: { fileId: ':id' }, source: 'src/routes/files.ts' },
  { method: 'POST', path: '/api/files/:id/publish', tenancy: 'workspace', scope: 'write', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'POST', path: '/api/files/:id/unpublish', tenancy: 'workspace', scope: 'write', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'DELETE', path: '/api/files/:id', tenancy: 'workspace', scope: 'delete', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'POST', path: '/api/files/:id/archive', tenancy: 'workspace', scope: 'delete', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'POST', path: '/api/files/:id/restore', tenancy: 'workspace', scope: 'write', ws: 'query', source: 'src/routes/files.ts' },
  { method: 'GET', path: '/api/gallery', tenancy: 'workspace', scope: 'files', ws: 'query', source: 'src/routes/gallery.ts' },

  // Shares
  { method: 'POST', path: '/api/workspaces/shares', tenancy: 'workspace', scope: 'write', ws: 'body', source: 'src/routes/shares.ts' },
  { method: 'GET', path: '/api/workspaces/shares', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/shares.ts' },
  { method: 'DELETE', path: '/api/shares/:id', tenancy: 'workspace', scope: 'delete', ws: 'query', source: 'src/routes/shares.ts' },

  // Jobs and operations
  { method: 'POST', path: '/api/jobs', tenancy: 'workspace', scope: 'write', ws: 'body', body: { jobType: 'graph_rebuild', idempotencyKey: 'isolation-probe' }, source: 'src/routes/jobs.ts' },
  { method: 'GET', path: '/api/jobs', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/jobs.ts' },
  { method: 'POST', path: '/api/jobs/:id/retry', tenancy: 'workspace', scope: 'write', ws: 'query', source: 'src/routes/jobs.ts' },
  { method: 'POST', path: '/api/jobs/run', tenancy: 'workspace', scope: 'write', ws: 'query', source: 'src/routes/jobs.ts' },
  { method: 'GET', path: '/api/activity', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/ops.ts' },
  { method: 'GET', path: '/api/ops/events', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/ops.ts' },
  { method: 'GET', path: '/api/ops/summary', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/ops.ts' },

  // Document search
  { method: 'POST', path: '/api/rag/documents', tenancy: 'workspace', scope: 'write', ws: 'body', body: { title: 'probe', text: 'probe' }, source: 'src/routes/rag.ts' },
  { method: 'GET', path: '/api/rag/documents', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/rag.ts' },
  { method: 'POST', path: '/api/rag/query', tenancy: 'workspace', scope: 'read', ws: 'body', body: { query: 'probe' }, source: 'src/routes/rag.ts' },
  { method: 'GET', path: '/api/rag/documents/:id', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/rag.ts' },
  { method: 'POST', path: '/api/rag/documents/:id/rename', tenancy: 'workspace', scope: 'write', ws: 'body', body: { title: 'probe' }, source: 'src/routes/rag.ts' },
  { method: 'DELETE', path: '/api/rag/documents/:id', tenancy: 'workspace', scope: 'delete', ws: 'query', source: 'src/routes/rag.ts' },

  // Ledger and graph
  { method: 'POST', path: '/api/epistemic/record', tenancy: 'workspace', scope: 'write', ws: 'body', body: { kind: 'entity', name: 'probe' }, source: 'src/routes/epistemic.ts' },
  { method: 'GET', path: '/api/epistemic/claims-as-of', tenancy: 'workspace', scope: 'read', ws: 'query', query: { asOfRecorded: NOW }, source: 'src/routes/epistemic.ts' },
  { method: 'GET', path: '/api/epistemic/belief-as-of', tenancy: 'workspace', scope: 'read', ws: 'query', query: { perspectiveId: ':id', claimId: ':id', asOfRecorded: NOW }, source: 'src/routes/epistemic.ts' },
  { method: 'POST', path: '/api/graph/project', tenancy: 'workspace', scope: 'write', ws: 'body', source: 'src/routes/graph.ts' },
  { method: 'GET', path: '/api/graph/health', tenancy: 'workspace', scope: 'read', ws: 'query', source: 'src/routes/graph.ts' },
  { method: 'POST', path: '/api/graph/query', tenancy: 'workspace', scope: 'read', ws: 'body', body: { query: 'MATCH (n) RETURN count(n)' }, source: 'src/routes/graph.ts' },

  // Analytics
  { method: 'POST', path: '/api/workspaces/:ws/datasets', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/datasets', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/analytics/specs', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/specs', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/analytics/schedules', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/schedules', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'DELETE', path: '/api/workspaces/:ws/analytics/schedules/:id', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/runs', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/analytics/queries', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/queries/:id', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/results/:id', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/results/:id/content', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/analytics/results/:id/rows', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/analytics.ts' },

  // Traces and UX analytics
  { method: 'POST', path: '/api/workspaces/:ws/otel/v1/traces', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/otel/v1/span_annotations', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/link', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/spans', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/traces', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/sessions', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/span_annotations', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/trace_annotations', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/session_annotations', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/otel/read/annotation_configs', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/traces.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/ux-analytics', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/ux-analytics.ts' },
  { method: 'GET', path: '/api/workspaces/:ws/ux-analytics/link', tenancy: 'workspace', scope: 'read', ws: 'path', source: 'src/routes/ux-analytics.ts' },
  { method: 'POST', path: '/api/workspaces/:ws/ux-analytics', tenancy: 'workspace', scope: 'write', ws: 'path', source: 'src/routes/ux-analytics.ts' },
];

/** A concrete path for a table row: `:ws` becomes the workspace id, `:id` the given id. */
export function concretePath(spec: RouteSpec, workspaceId: string, id: string): string {
  return spec.path.replace(':ws', workspaceId).replace(/:id/g, id);
}
