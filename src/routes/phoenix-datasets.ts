/**
 * Phoenix datasets and experiments through a workspace's otel routes (#47).
 *
 * One Phoenix serves every workspace. Its traces are fenced by project, but its
 * datasets, dataset versions, experiments and experiment runs are global, so
 * handing Phoenix's routes through would let one workspace read another's. Octo
 * closes that here:
 *
 * - Every id in a path or body must be one this workspace created. Octo records
 *   the id when Phoenix returns it (octo.phoenix_resources) and answers 404 for
 *   any other, so a guessed id reads nothing.
 * - A dataset name is prefixed with the workspace id on the way in and stripped on
 *   the way out, so two workspaces can both have a dataset called `cases`.
 * - Anything that names another resource has to name one this workspace owns: an
 *   experiment's dataset version, a run's dataset example, an evaluation's run. An
 *   upload may not build a dataset from spans, which would copy another workspace's
 *   traces in.
 * - Only the routes below are open; the rest of Phoenix's API (delete, prompts,
 *   users, keys, other projects) is not reachable.
 *
 * The caller points `arize-phoenix-client` at `/api/workspaces/<id>/otel` with a
 * workspace key. Reads need the `read` scope, writes the `write` scope, and the
 * Phoenix secret stays in Octo. Config is the same as the trace routes.
 */

import { authenticateRequest, keyWorkspaceMatches, requireScope, scopeDenied } from '../server/auth-context';
import {
  dbGetWorkspaceById,
  dbGetWorkspaceMembership,
  dbListPhoenixResourceIds,
  dbPhoenixResourceOwned,
  dbRecordPhoenixResources,
  type PhoenixResourceKind,
} from '../server/db';
import { sendJson } from '../server/http';
import { UUID_PATTERN } from '../server/runtime';
import type { IncomingMessage, ServerResponse } from 'http';

const BODY_MAX_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 30_000;
const LIST_PAGE = 100;
const LIST_MAX_PAGES = 50;

const ROUTE = /^\/api\/workspaces\/([^/]+)\/otel\/(v1\/(?:datasets|experiments|experiment_evaluations|projects)(?:\/[^/]+){0,3})$/;
/** What an upload may carry. `span_ids` and `splits` would reach resources Octo does not track. */
const UPLOAD_FIELDS = new Set(['action', 'name', 'description', 'inputs', 'outputs', 'metadata']);
/** Phoenix global ids are base64. Anything else in an id position is refused. */
const ID_SEGMENT = /^[A-Za-z0-9+=_-]{1,200}$/;

type Op =
  | 'listDatasets'
  | 'uploadDataset'
  | 'dataset'
  | 'datasetRead'
  | 'createExperiment'
  | 'datasetExperiments'
  | 'experiment'
  | 'experimentRead'
  | 'createRun'
  | 'listRuns'
  | 'evaluate'
  | 'listProjects'
  | 'project';

const OPS: Array<{ method: 'GET' | 'POST'; pattern: RegExp; op: Op }> = [
  { method: 'GET', pattern: /^v1\/datasets$/, op: 'listDatasets' },
  { method: 'POST', pattern: /^v1\/datasets\/upload$/, op: 'uploadDataset' },
  { method: 'GET', pattern: /^v1\/datasets\/([^/]+)$/, op: 'dataset' },
  { method: 'GET', pattern: /^v1\/datasets\/([^/]+)\/(examples|versions|csv|jsonl)$/, op: 'datasetRead' },
  { method: 'POST', pattern: /^v1\/datasets\/([^/]+)\/experiments$/, op: 'createExperiment' },
  { method: 'GET', pattern: /^v1\/datasets\/([^/]+)\/experiments$/, op: 'datasetExperiments' },
  { method: 'GET', pattern: /^v1\/experiments\/([^/]+)$/, op: 'experiment' },
  { method: 'GET', pattern: /^v1\/experiments\/([^/]+)\/(json|csv)$/, op: 'experimentRead' },
  { method: 'POST', pattern: /^v1\/experiments\/([^/]+)\/runs$/, op: 'createRun' },
  { method: 'GET', pattern: /^v1\/experiments\/([^/]+)\/runs$/, op: 'listRuns' },
  { method: 'POST', pattern: /^v1\/experiment_evaluations$/, op: 'evaluate' },
  { method: 'GET', pattern: /^v1\/projects$/, op: 'listProjects' },
  { method: 'GET', pattern: /^v1\/projects\/([^/]+)$/, op: 'project' },
];

function readBody(req: IncomingMessage): Promise<Buffer | null> {
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringAt(value: unknown, ...path: string[]): string | null {
  let node = value;
  for (const key of path) {
    if (!isObject(node)) return null;
    node = node[key];
  }
  return typeof node === 'string' && node.length > 0 ? node : null;
}

export async function handlePhoenixDatasetRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const match = ROUTE.exec(url.pathname);
  if (!match) return false;
  const workspaceId = match[1]!;
  const rest = match[2]!;

  let found: { op: Op; args: string[] } | null = null;
  for (const entry of OPS) {
    if (entry.method !== req.method) continue;
    const hit = entry.pattern.exec(rest);
    if (hit) {
      found = { op: entry.op, args: hit.slice(1) };
      break;
    }
  }
  if (!found) return false;
  const { op, args } = found;

  const auth = await authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { error: 'UNAUTHENTICATED' });
    return true;
  }
  const scope = req.method === 'GET' ? 'read' : 'write';
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
  const prefix = `${workspaceId}/`;

  const notFound = () => sendJson(res, 404, { error: 'NOT_FOUND: no such resource in this workspace' });

  /** Calls Phoenix; null means it could not be reached (already answered 502). */
  async function phoenix(method: 'GET' | 'POST', path: string, body?: string): Promise<Response | null> {
    try {
      return await fetch(`${base}${path}`, {
        method,
        headers: { ...authHeader, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch {
      sendJson(res, 502, { error: 'TRACES_UPSTREAM_UNREACHABLE' });
      return null;
    }
  }

  /** Sends Phoenix's answer on. Only the content type is copied, never its other headers. */
  function relay(upstream: Response, text: string): void {
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
    res.end(text);
  }

  function stripName(node: unknown): unknown {
    if (isObject(node) && typeof node['name'] === 'string' && node['name'].startsWith(prefix)) {
      return { ...node, name: node['name'].slice(prefix.length) };
    }
    return node;
  }

  /** True when the id in the path is one this workspace made. Answers 404 otherwise. */
  async function owns(kind: PhoenixResourceKind, id: string | undefined): Promise<boolean> {
    if (!id || !ID_SEGMENT.test(id) || !(await dbPhoenixResourceOwned(workspaceId, kind, id))) {
      notFound();
      return false;
    }
    return true;
  }

  /** The request body as a JSON object, or null after answering 400, 413 or 415. */
  async function jsonBody(): Promise<{ object: Record<string, unknown>; text: string } | null> {
    if (!String(req.headers['content-type'] ?? '').toLowerCase().includes('application/json')) {
      sendJson(res, 415, { error: 'UNSUPPORTED_MEDIA_TYPE: send application/json' });
      return null;
    }
    const raw = await readBody(req);
    if (!raw) {
      sendJson(res, 413, { error: 'PAYLOAD_TOO_LARGE' });
      return null;
    }
    const text = raw.toString('utf8');
    try {
      const parsed: unknown = JSON.parse(text);
      if (isObject(parsed)) return { object: parsed, text };
    } catch {
      // fall through to the refusal
    }
    sendJson(res, 400, { error: 'BAD_REQUEST: body must be a JSON object' });
    return null;
  }

  /** Records the ids Phoenix just returned so later calls with them are allowed. */
  async function record(upstream: Response, text: string, picks: Array<[PhoenixResourceKind, string[]]>) {
    if (upstream.status < 200 || upstream.status >= 300) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const resources: Array<{ kind: PhoenixResourceKind; id: string }> = [];
    for (const [kind, path] of picks) {
      const id = stringAt(parsed, ...path);
      if (id && ID_SEGMENT.test(id)) resources.push({ kind, id });
    }
    await dbRecordPhoenixResources(workspaceId, resources);
  }

  const id = args[0];

  switch (op) {
    case 'listDatasets': {
      const owned = new Set(await dbListPhoenixResourceIds(workspaceId, 'dataset'));
      const wanted = url.searchParams.get('name');
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 1000, 1), 1000);
      const data: unknown[] = [];
      let cursor: string | null = null;
      for (let page = 0; owned.size > 0 && page < LIST_MAX_PAGES && data.length < owned.size; page++) {
        const query = `limit=${LIST_PAGE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
        const upstream = await phoenix('GET', `/v1/datasets?${query}`);
        if (!upstream) return true;
        const text = await upstream.text();
        if (!upstream.ok) {
          relay(upstream, text);
          return true;
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          sendJson(res, 502, { error: 'TRACES_UPSTREAM_BAD_RESPONSE' });
          return true;
        }
        const rows = isObject(parsed) && Array.isArray(parsed['data']) ? (parsed['data'] as unknown[]) : [];
        for (const row of rows) {
          if (isObject(row) && typeof row['id'] === 'string' && owned.has(row['id'])) data.push(stripName(row));
        }
        cursor = isObject(parsed) && typeof parsed['next_cursor'] === 'string' ? parsed['next_cursor'] : null;
        if (!cursor) break;
      }
      const shown = data.filter((row) => !wanted || (isObject(row) && row['name'] === wanted)).slice(0, limit);
      sendJson(res, 200, { data: shown, next_cursor: null });
      return true;
    }

    case 'uploadDataset': {
      const body = await jsonBody();
      if (!body) return true;
      const action = body.object['action'];
      const name = body.object['name'];
      if ((action !== 'create' && action !== 'append') || typeof name !== 'string' || !name || name.length > 200) {
        sendJson(res, 400, { error: 'BAD_REQUEST: action must be create or append and name a non-empty string' });
        return true;
      }
      // Only plain rows. `span_ids` would copy spans from any project into this dataset.
      const extra = Object.keys(body.object).filter((key) => !UPLOAD_FIELDS.has(key));
      if (extra.length > 0) {
        sendJson(res, 400, { error: `BAD_REQUEST: unsupported field(s) ${extra.join(', ')}; allowed: ${Array.from(UPLOAD_FIELDS).join(', ')}` });
        return true;
      }
      // sync=true so Phoenix answers with the ids that Octo has to record.
      const upstream = await phoenix(
        'POST',
        '/v1/datasets/upload?sync=true',
        JSON.stringify({ ...body.object, name: `${prefix}${name}` })
      );
      if (!upstream) return true;
      const text = await upstream.text();
      await record(upstream, text, [
        ['dataset', ['data', 'dataset_id']],
        ['version', ['data', 'version_id']],
      ]);
      relay(upstream, text);
      return true;
    }

    case 'dataset': {
      if (!(await owns('dataset', id))) return true;
      const upstream = await phoenix('GET', `/v1/datasets/${encodeURIComponent(id!)}`);
      if (!upstream) return true;
      const text = await upstream.text();
      try {
        const parsed = JSON.parse(text) as unknown;
        if (isObject(parsed) && upstream.ok) {
          sendJson(res, upstream.status, { ...parsed, data: stripName(parsed['data']) });
          return true;
        }
      } catch {
        // not JSON: pass it on as it is
      }
      relay(upstream, text);
      return true;
    }

    case 'datasetRead': {
      if (!(await owns('dataset', id))) return true;
      // A version of someone else's dataset must not be named on this dataset's reads.
      const versionParam = url.searchParams.get('version_id');
      if (versionParam !== null && !(await owns('version', versionParam))) return true;
      const what = args[1]!;
      const upstream = await phoenix('GET', `/v1/datasets/${encodeURIComponent(id!)}/${what}${url.search}`);
      if (!upstream) return true;
      const text = await upstream.text();
      // Reading examples and versions is how a client learns their ids; remember them
      // so a later experiment can name them and nothing else.
      if (upstream.ok && (what === 'examples' || what === 'versions')) {
        try {
          const parsed: unknown = JSON.parse(text);
          const resources: Array<{ kind: PhoenixResourceKind; id: string }> = [];
          const data = isObject(parsed) ? parsed['data'] : null;
          if (what === 'examples' && isObject(data)) {
            const version = stringAt(data, 'version_id');
            if (version && ID_SEGMENT.test(version)) resources.push({ kind: 'version', id: version });
            for (const example of Array.isArray(data['examples']) ? (data['examples'] as unknown[]) : []) {
              const exampleId = stringAt(example, 'id');
              if (exampleId && ID_SEGMENT.test(exampleId)) resources.push({ kind: 'example', id: exampleId });
            }
          } else if (what === 'versions' && Array.isArray(data)) {
            for (const row of data as unknown[]) {
              const versionId = stringAt(row, 'version_id');
              if (versionId && ID_SEGMENT.test(versionId)) resources.push({ kind: 'version', id: versionId });
            }
          }
          await dbRecordPhoenixResources(workspaceId, resources);
        } catch {
          // an unparseable answer records nothing; the caller still gets it
        }
      }
      relay(upstream, text);
      return true;
    }

    case 'createExperiment': {
      if (!(await owns('dataset', id))) return true;
      const body = await jsonBody();
      if (!body) return true;
      // A version of someone else's dataset would let the experiment read its examples.
      const version = body.object['version_id'];
      if (version !== undefined && version !== null) {
        if (typeof version !== 'string') {
          sendJson(res, 400, { error: 'BAD_REQUEST: version_id must be a string' });
          return true;
        }
        if (!(await owns('version', version))) return true;
      }
      const upstream = await phoenix('POST', `/v1/datasets/${encodeURIComponent(id!)}/experiments`, body.text);
      if (!upstream) return true;
      const text = await upstream.text();
      await record(upstream, text, [['experiment', ['data', 'id']]]);
      relay(upstream, text);
      return true;
    }

    case 'datasetExperiments': {
      if (!(await owns('dataset', id))) return true;
      const upstream = await phoenix('GET', `/v1/datasets/${encodeURIComponent(id!)}/experiments${url.search}`);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }

    case 'experiment': {
      if (!(await owns('experiment', id))) return true;
      const upstream = await phoenix('GET', `/v1/experiments/${encodeURIComponent(id!)}`);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }

    case 'experimentRead': {
      if (!(await owns('experiment', id))) return true;
      const upstream = await phoenix('GET', `/v1/experiments/${encodeURIComponent(id!)}/${args[1]}`);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }

    case 'createRun': {
      if (!(await owns('experiment', id))) return true;
      const body = await jsonBody();
      if (!body) return true;
      // An example of another workspace's dataset would show up in this experiment's export.
      const example = body.object['dataset_example_id'];
      if (typeof example !== 'string') {
        sendJson(res, 400, { error: 'BAD_REQUEST: dataset_example_id is required' });
        return true;
      }
      if (!(await owns('example', example))) return true;
      const upstream = await phoenix('POST', `/v1/experiments/${encodeURIComponent(id!)}/runs`, body.text);
      if (!upstream) return true;
      const text = await upstream.text();
      await record(upstream, text, [['run', ['data', 'id']]]);
      relay(upstream, text);
      return true;
    }

    case 'listRuns': {
      if (!(await owns('experiment', id))) return true;
      const upstream = await phoenix('GET', `/v1/experiments/${encodeURIComponent(id!)}/runs${url.search}`);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }

    case 'evaluate': {
      const body = await jsonBody();
      if (!body) return true;
      const run = body.object['experiment_run_id'];
      if (typeof run !== 'string' || !(await owns('run', run))) {
        if (typeof run !== 'string') sendJson(res, 400, { error: 'BAD_REQUEST: experiment_run_id is required' });
        return true;
      }
      const upstream = await phoenix('POST', '/v1/experiment_evaluations', body.text);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }

    case 'listProjects': {
      const upstream = await phoenix('GET', `/v1/projects/${encodeURIComponent(workspace.slug)}`);
      if (!upstream) return true;
      // A project Phoenix has not created yet (no spans) is an empty list, not an error.
      if (upstream.status === 404) {
        sendJson(res, 200, { data: [], next_cursor: null });
        return true;
      }
      const text = await upstream.text();
      try {
        const parsed = JSON.parse(text) as unknown;
        if (upstream.ok && isObject(parsed) && isObject(parsed['data'])) {
          sendJson(res, 200, { data: [parsed['data']], next_cursor: null });
          return true;
        }
      } catch {
        // fall through to the plain relay
      }
      relay(upstream, text);
      return true;
    }

    case 'project': {
      let requested = id ?? '';
      try {
        requested = decodeURIComponent(requested);
      } catch {
        // keep the raw segment; it will not match the slug
      }
      if (requested !== workspace.slug) {
        notFound();
        return true;
      }
      const upstream = await phoenix('GET', `/v1/projects/${encodeURIComponent(workspace.slug)}`);
      if (!upstream) return true;
      relay(upstream, await upstream.text());
      return true;
    }
  }
}
