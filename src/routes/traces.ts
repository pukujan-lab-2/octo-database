/**
 * Traces and eval scores (#268, #342).
 *
 * One Phoenix runs next to Octo. An agent sends OTLP/HTTP traces here with its
 * normal Octo key; Octo checks the key and the workspace, then forwards the bytes
 * unchanged to Phoenix with the project set to the workspace's slug. Phoenix
 * creates the project on its first span. Eval scores (span annotations) go the
 * same way. The Phoenix secret stays in Octo.
 *
 * Reads go the same way: GET .../otel/read/<resource> asks Phoenix for the
 * workspace's own project only. The project is the workspace slug in the Phoenix
 * path, never a caller value, and only project-scoped resources are allowed:
 * Phoenix's datasets, experiments, prompts and lookups by global id are not
 * separated per workspace, so they are not exposed (#442).
 *
 *   OCTO_PHOENIX_URL         internal Phoenix base URL, e.g. http://octo-phoenix:6006.
 *   OCTO_PHOENIX_SECRET      Phoenix's PHOENIX_ADMIN_SECRET (bearer token).
 *   OCTO_PHOENIX_PUBLIC_URL  where people open Phoenix, for the dashboard link.
 */

import { authenticateRequest, keyWorkspaceMatches, requireScope, scopeDenied } from '../server/auth-context';
import { dbGetWorkspaceById, dbGetWorkspaceMembership } from '../server/db';
import { sendJson } from '../server/http';
import { UUID_PATTERN } from '../server/runtime';
import type { IncomingMessage, ServerResponse } from 'http';

const BODY_MAX_BYTES = 8 * 1024 * 1024;
/** Phoenix resources that live under /v1/projects/<project>/, so the project fences them. */
const READ_RESOURCES = [
  'spans',
  'traces',
  'sessions',
  'span_annotations',
  'trace_annotations',
  'session_annotations',
  'annotation_configs',
];
const ROUTE = new RegExp(
  `^/api/workspaces/([^/]+)/otel/(v1/traces|v1/span_annotations|link|read/(?:${READ_RESOURCES.join('|')}))$`
);

function readRaw(req: IncomingMessage): Promise<Buffer | null> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer | null>();
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > BODY_MAX_BYTES) {
      resolve(null);
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
  return promise;
}

export async function handleTracesRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const match = ROUTE.exec(url.pathname);
  if (!match) return false;
  const [, workspaceId, action] = match as unknown as [string, string, string];
  const isLink = action === 'link';
  const isRead = action.startsWith('read/');
  if (req.method !== (isLink || isRead ? 'GET' : 'POST')) return false;

  const auth = await authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { error: 'UNAUTHENTICATED' });
    return true;
  }
  const scope = isLink || isRead ? 'read' : 'write';
  if (!requireScope(auth, scope)) {
    scopeDenied(res, scope);
    return true;
  }
  if (!UUID_PATTERN.test(workspaceId)) {
    sendJson(res, 400, { error: 'BAD_REQUEST: workspaceId must be a valid UUID' });
    return true;
  }
  if (!keyWorkspaceMatches(auth, workspaceId)) {
    sendJson(res, 403, { error: 'FORBIDDEN: Key restricted to different workspace' });
    return true;
  }
  const mem = await dbGetWorkspaceMembership(workspaceId, auth.principal.id);
  if (!mem && !auth.principal.isPlatformOwner) {
    sendJson(res, 403, { error: 'FORBIDDEN: Not a member of this workspace' });
    return true;
  }
  const workspace = await dbGetWorkspaceById(workspaceId);
  if (!workspace) {
    sendJson(res, 404, { error: 'WORKSPACE_NOT_FOUND' });
    return true;
  }

  const base = process.env['OCTO_PHOENIX_URL']?.replace(/\/+$/, '');
  const secret = process.env['OCTO_PHOENIX_SECRET'];
  if (!base) {
    sendJson(res, 503, { error: 'TRACES_NOT_CONFIGURED: set OCTO_PHOENIX_URL' });
    return true;
  }
  const authHeader: Record<string, string> = secret ? { authorization: `Bearer ${secret}` } : {};
  const project = workspace.slug;

  if (isRead) {
    const resource = action.slice('read/'.length);
    // The caller's query (limit, cursor, filters) goes through; the project cannot be changed.
    let upstream: Response;
    try {
      upstream = await fetch(`${base}/v1/projects/${encodeURIComponent(project)}/${resource}${url.search}`, {
        headers: authHeader,
      });
    } catch {
      sendJson(res, 502, { error: 'TRACES_UPSTREAM_UNREACHABLE' });
      return true;
    }
    const text = await upstream.text();
    // A project with no spans yet does not exist in Phoenix; that is an empty result, not an error.
    if (upstream.status === 404) {
      sendJson(res, 200, { data: [], next_cursor: null });
      return true;
    }
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
    res.end(text);
    return true;
  }

  if (isLink) {
    const publicUrl = (process.env['OCTO_PHOENIX_PUBLIC_URL'] ?? base).replace(/\/+$/, '');
    const found = await fetch(`${base}/v1/projects/${encodeURIComponent(project)}`, { headers: authHeader })
      .then((r) => (r.ok ? (r.json() as Promise<{ data?: { id?: string } }>) : null))
      .catch(() => null);
    const id = found?.data?.id;
    sendJson(res, 200, { project, url: id ? `${publicUrl}/projects/${id}` : `${publicUrl}/projects` });
    return true;
  }

  const body = await readRaw(req);
  if (!body) {
    sendJson(res, 413, { error: 'PAYLOAD_TOO_LARGE' });
    return true;
  }
  const headers: Record<string, string> = { ...authHeader, 'x-project-name': project };
  for (const name of ['content-type', 'content-encoding']) {
    const value = req.headers[name];
    if (typeof value === 'string') headers[name] = value;
  }
  // Annotations name the project in the query string; traces use the header.
  const target =
    action === 'v1/span_annotations' ? `${base}/v1/span_annotations${url.search}` : `${base}/v1/traces`;
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: 'POST', headers, body: new Uint8Array(body) });
  } catch {
    sendJson(res, 502, { error: 'TRACES_UPSTREAM_UNREACHABLE' });
    return true;
  }
  const out = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, {
    'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
    'access-control-allow-origin': '*',
  });
  res.end(out);
  return true;
}
