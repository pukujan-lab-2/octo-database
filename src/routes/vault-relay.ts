/**
 * Credential egress relay.
 *
 * A working key (`octo_tmp_…`) is a real credential the owner can attach to a
 * program: requests carrying it arrive here, Octo swaps in the stored vendor
 * secret, and forwards upstream. The vendor secret never leaves Octo, and the
 * working key never reaches the vendor.
 *
 * `/api/vault/proxy` is the free-form path: the caller names any http(s)
 * upstream per request, so a working key is not pinned to one base URL. The
 * older `/api/vault/relay/<routeKey>` remains for routes created in the
 * dashboard.
 *
 * This family is registered before handleVaultRoutes in src/server/index.ts,
 * because that family claims every /api/vault path and would 404 these.
 */

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable, type Duplex } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { hashApiKeySecret } from '../lib/secret-hash';
import { decryptSecret } from '../lib/mfa';
import {
  buildProxyRequest,
  buildUpstreamRequest,
  classifyUpstream,
  createSecretScrubber,
  extractTempKey,
  planRedirect,
  redactTempKeys,
  scrubSecrets,
  type BuiltUpstreamRequest,
} from '../lib/relay-egress';
import { parseLeaseDays } from '../lib/vault-policy';
import {
  dbConsumeVaultLease,
  dbConsumeVaultLeaseByKey,
  dbGetVaultLeaseByKey,
  dbRenewVaultLease,
  dbUpdateVaultRouteHealth,
  type ConsumedVaultLease,
  type ConsumedVaultLeaseAny,
} from '../server/db';
import { readJsonObject, sendJson, type RouteHandler } from '../server/http';
import type { IncomingMessage, ServerResponse } from 'http';

const BODY_MAX_BYTES = 1024 * 1024;

function readBodyLimited(req: IncomingMessage, max: number): Promise<Buffer | null> {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer | null>();
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (chunk: Buffer) => {
    size += chunk.length;
    if (size > max) {
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

function upstreamHeaders(headers: Headers, secretForms: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Array.from(headers.entries())) {
    const lower = name.toLowerCase();
    if (
      lower === 'transfer-encoding' ||
      lower === 'connection' ||
      lower === 'keep-alive' ||
      lower === 'content-encoding' ||
      lower === 'content-length'
    ) {
      continue;
    }
    out[name] = scrubSecrets(value, secretForms);
  }
  return out;
}

async function relay(req: IncomingMessage, res: ServerResponse, url: URL, routeKey: string): Promise<boolean> {
  const { key, ambiguous } = extractTempKey(req, url);
  if (ambiguous) {
    sendJson(res, 400, { error: 'WORKING_KEY_AMBIGUOUS: send exactly one working key.' });
    return true;
  }
  if (!key) {
    sendJson(res, 401, { error: 'WORKING_KEY_MISSING: attach the working key the way this route expects.' });
    return true;
  }

  const lease = await dbConsumeVaultLease(hashApiKeySecret(key), routeKey);
  if (!lease || !lease.secretEncrypted) {
    sendJson(res, 401, { error: 'WORKING_KEY_INVALID: that key is unknown, expired, revoked, or not valid for this route.' });
    return true;
  }

  const secret = decryptSecret(lease.secretEncrypted);
  const method = (req.method ?? 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let buffered: Buffer | null = null;
  if (hasBody && lease.authScheme === 'body_json') {
    buffered = await readBodyLimited(req, BODY_MAX_BYTES);
    if (!buffered) {
      sendJson(res, 413, { error: 'BODY_TOO_LARGE: a rewritten body must be 1 MB or smaller.' });
      return true;
    }
  }

  const built = buildUpstreamRequest({
    route: {
      baseUrl: lease.baseUrl,
      authScheme: lease.authScheme,
      authHeader: lease.authHeader,
      bodyField: lease.bodyField,
      basicUsername: lease.basicUsername,
      itemUsername: lease.itemUsername,
    },
    secret,
    tempKey: key,
    method,
    url,
    headers: req.headers,
    body: buffered,
  });
  if ('error' in built) {
    sendJson(res, built.status, { error: `${built.error}: the route could not build an upstream request.` });
    return true;
  }

  return forwardUpstream({
    req,
    res,
    built,
    method,
    hasBody,
    buffered,
    onUpstream: (status, detail) => {
      const health = classifyUpstream(status);
      void dbUpdateVaultRouteHealth(lease.principalId, lease.routeId, health.status, detail ?? health.detail).catch(
        () => undefined
      );
    },
  });
}

/** Same-origin vendor redirects followed before the hop goes back to the caller. */
const MAX_REDIRECTS = 5;

/**
 * Sends the built request upstream and streams the answer back. Shared by the
 * pinned route relay and the free-form proxy so both behave identically.
 *
 * The stored secret never comes back to the caller: same-origin redirects are
 * followed here (see planRedirect), and every response header and the body
 * are scrubbed of the secret before they are forwarded.
 */
async function forwardUpstream(input: {
  req: IncomingMessage;
  res: ServerResponse;
  built: BuiltUpstreamRequest;
  method: string;
  hasBody: boolean;
  buffered: Buffer | null;
  onUpstream?: (status: number | 'error', detail?: string) => void;
}): Promise<true> {
  const controller = new AbortController();
  input.req.on('aborted', () => controller.abort());
  input.res.on('close', () => controller.abort());

  const streamed = input.hasBody && !input.buffered;
  let body: ReadableStream | Buffer | null = streamed ? (Readable.toWeb(input.req) as unknown as ReadableStream) : input.buffered;
  let built = input.built;
  let method = input.method;
  let location: string | null = null;

  let upstream: Response;
  for (let hop = 0; ; hop++) {
    try {
      upstream = await fetch(built.url, {
        method,
        headers: built.headers,
        body,
        duplex: 'half',
        redirect: 'manual',
        signal: controller.signal,
      } as RequestInit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const detail = scrubSecrets(redactTempKeys(message), built.secretForms);
      input.onUpstream?.('error', detail);
      if (!input.res.headersSent) sendJson(input.res, 502, { error: 'EGRESS_FAILED: the vendor did not answer.' });
      return true;
    }

    const rawLocation = upstream.status >= 300 && upstream.status < 400 ? upstream.headers.get('location') : null;
    if (!rawLocation) break;
    const plan = planRedirect({ built, status: upstream.status, location: rawLocation, method, streamedBody: streamed });
    if (!plan.follow || hop >= MAX_REDIRECTS) {
      location = plan.location;
      break;
    }
    await upstream.body?.cancel().catch(() => undefined);
    built = plan.built;
    method = plan.method;
    body = built.body;
  }

  input.onUpstream?.(upstream.status);

  const headers = upstreamHeaders(upstream.headers, built.secretForms);
  if (location !== null) {
    for (const name of Object.keys(headers)) if (name.toLowerCase() === 'location') delete headers[name];
    headers['location'] = location;
  }
  input.res.writeHead(upstream.status, headers);
  if (!upstream.body) {
    input.res.end();
    return true;
  }
  try {
    await pipeline(
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]),
      createSecretScrubber(built.secretForms),
      input.res
    );
  } catch {
    // Headers are already out; killing the socket is the only honest answer.
    input.res.destroy();
  }
  return true;
}

/**
 * The caller names the upstream. An absolute http(s) or ws(s) URL is used as-is; a
 * relative path resolves against the lease's default upstream.
 */
function resolveTarget(raw: string | null, defaultTarget: string | null): string | null {
  if (!raw) return defaultTarget;
  if (/^(https?|wss?):\/\//i.test(raw)) return raw;
  if (!defaultTarget) return null;
  return defaultTarget.replace(/\/+$/, '') + (raw.startsWith('/') ? raw : `/${raw}`);
}

/** Target from x-octo-target, then ?target=, then the path after /api/vault/proxy. */
function proxyTarget(req: IncomingMessage, url: URL): string | null {
  const header = req.headers['x-octo-target'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  if (fromHeader?.trim()) return fromHeader.trim();

  const fromQuery = url.searchParams.get('target');
  if (fromQuery?.trim()) return fromQuery.trim();

  const suffix = url.pathname.replace(/^\/api\/vault\/proxy\/?/, '');
  if (!suffix) return null;
  try {
    return decodeURIComponent(suffix) + url.search;
  } catch {
    return suffix + url.search;
  }
}

/**
 * Free-form egress: the working key carries the injection recipe, the caller
 * names any upstream per request. No route is involved, so the key is never
 * pinned to one base URL.
 */
async function proxy(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const { key, ambiguous } = extractTempKey(req, url);
  if (ambiguous) {
    sendJson(res, 400, { error: 'WORKING_KEY_AMBIGUOUS: send exactly one working key.' });
    return true;
  }
  if (!key) {
    sendJson(res, 401, { error: 'WORKING_KEY_MISSING: attach the working key.' });
    return true;
  }

  const lease: ConsumedVaultLeaseAny | null = await dbConsumeVaultLeaseByKey(hashApiKeySecret(key));
  if (!lease || !lease.secretEncrypted) {
    sendJson(res, 401, { error: 'WORKING_KEY_INVALID: that key is unknown, expired, or revoked.' });
    return true;
  }

  const targetUrl = resolveTarget(proxyTarget(req, url), lease.baseUrl);
  if (!targetUrl) {
    sendJson(res, 400, {
      error:
        'TARGET_REQUIRED: name the vendor URL in x-octo-target, in ?target=, or as the path after /api/vault/proxy.',
      code: 'TARGET_REQUIRED',
    });
    return true;
  }

  const secret = decryptSecret(lease.secretEncrypted);
  const method = (req.method ?? 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';

  let buffered: Buffer | null = null;
  if (hasBody && lease.authScheme === 'body_json') {
    buffered = await readBodyLimited(req, BODY_MAX_BYTES);
    if (!buffered) {
      sendJson(res, 413, { error: 'BODY_TOO_LARGE: a rewritten body must be 1 MB or smaller.' });
      return true;
    }
  }

  const built = buildProxyRequest({
    targetUrl,
    route: {
      baseUrl: lease.baseUrl ?? targetUrl,
      authScheme: lease.authScheme,
      authHeader: lease.authHeader,
      bodyField: lease.bodyField,
      basicUsername: lease.basicUsername,
      itemUsername: lease.itemUsername,
    },
    secret,
    tempKey: key,
    headers: req.headers,
    body: buffered,
  });
  if ('error' in built) {
    sendJson(res, built.status, { error: `${built.error}: the proxy could not build an upstream request.` });
    return true;
  }

  return forwardUpstream({ req, res, built, method, hasBody, buffered });
}

export const handleVaultRelayRoutes: RouteHandler = async (req, res, url) => {
  const path = url.pathname;

  if (path === '/api/vault/lease/renew' && req.method === 'POST') {
    const { key, ambiguous } = extractTempKey(req, url);
    if (ambiguous) {
      sendJson(res, 400, { error: 'WORKING_KEY_AMBIGUOUS: send exactly one working key.' });
      return true;
    }
    if (!key) {
      sendJson(res, 401, { error: 'WORKING_KEY_MISSING: attach the working key.' });
      return true;
    }
    const body = await readJsonObject(req);
    const days = parseLeaseDays(body['expiresInDays']);
    if (!days.ok) {
      sendJson(res, 400, { error: days.error });
      return true;
    }
    const expiresAt = await dbRenewVaultLease(hashApiKeySecret(key), days.days);
    if (!expiresAt) {
      sendJson(res, 401, { error: 'LEASE_EXPIRED: that working key has expired or been revoked.' });
      return true;
    }
    sendJson(res, 200, { expiresAt });
    return true;
  }

  if (path === '/api/vault/lease/info' && req.method === 'GET') {
    const { key, ambiguous } = extractTempKey(req, url);
    if (ambiguous) {
      sendJson(res, 400, { error: 'WORKING_KEY_AMBIGUOUS: send exactly one working key.' });
      return true;
    }
    if (!key) {
      sendJson(res, 401, { error: 'WORKING_KEY_MISSING: attach the working key.' });
      return true;
    }
    const lease = await dbGetVaultLeaseByKey(hashApiKeySecret(key));
    if (!lease) {
      sendJson(res, 401, { error: 'LEASE_EXPIRED: that working key has expired or been revoked.' });
      return true;
    }
    sendJson(res, 200, {
      lease: {
        id: lease.id,
        itemId: lease.itemId,
        itemLabel: lease.itemLabel,
        prefix: lease.prefix,
        expiresAt: lease.expiresAt,
        lastUsedAt: lease.lastUsedAt,
      },
    });
    return true;
  }

  if (path === '/api/vault/proxy' || path.startsWith('/api/vault/proxy/')) {
    return proxy(req, res, url);
  }

  const match = path.match(/^\/api\/vault\/relay\/([a-z0-9][a-z0-9-]*)(\/.*)?$/);
  if (!match) return false;
  const routeKey = match[1]!;
  return relay(req, res, url, routeKey);
};

/**
 * WebSocket egress. Octo only handles the opening handshake: it checks the
 * working key, injects the stored secret into the upgrade request, and, once the
 * vendor answers 101, pipes the two sockets together. Frames, pings and closes
 * pass through untouched, so no WebSocket library is involved.
 *
 * The secret is scrubbed from the vendor's handshake headers (or from a refusal
 * body); message frames are not inspected.
 */
const STATUS_TEXT: Record<number, string> = { 400: 'Bad Request', 401: 'Unauthorized', 404: 'Not Found', 502: 'Bad Gateway' };

function refuseUpgrade(socket: Duplex, status: number, message: string): void {
  const body = JSON.stringify({ error: message });
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_TEXT[status] ?? 'Error'}\r\nContent-Type: application/json\r\n` +
      `Content-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`
  );
}

function writeHandshakeHead(
  socket: Duplex,
  statusLine: string,
  rawHeaders: string[],
  forms: string[],
  keep: (name: string) => boolean,
  extra = ''
): void {
  let head = `${statusLine}\r\n${extra}`;
  for (let i = 0; i < rawHeaders.length; i += 2) {
    const name = rawHeaders[i]!;
    if (keep(name.toLowerCase())) head += `${name}: ${scrubSecrets(rawHeaders[i + 1]!, forms)}\r\n`;
  }
  socket.write(`${head}\r\n`);
}

const BODY_FRAMING_HEADERS = new Set(['transfer-encoding', 'connection', 'keep-alive', 'content-encoding', 'content-length']);

export async function handleVaultRelayUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
  socket.on('error', () => socket.destroy());
  let url: URL;
  try {
    url = new URL(req.url ?? '/', 'http://localhost');
  } catch {
    return refuseUpgrade(socket, 400, 'BAD_REQUEST: malformed request target');
  }
  const path = url.pathname;
  const isProxy = path === '/api/vault/proxy' || path.startsWith('/api/vault/proxy/');
  const relayMatch = path.match(/^\/api\/vault\/relay\/([a-z0-9][a-z0-9-]*)(\/.*)?$/);
  if (!isProxy && !relayMatch) return refuseUpgrade(socket, 404, `Not found: ${req.method} ${path}`);

  const { key, ambiguous } = extractTempKey(req, url);
  if (ambiguous) return refuseUpgrade(socket, 400, 'WORKING_KEY_AMBIGUOUS: send exactly one working key.');
  if (!key) return refuseUpgrade(socket, 401, 'WORKING_KEY_MISSING: attach the working key.');

  try {
    const keyHash = hashApiKeySecret(key);
    const routeLease: ConsumedVaultLease | null = relayMatch ? await dbConsumeVaultLease(keyHash, relayMatch[1]!) : null;
    const lease: ConsumedVaultLeaseAny | null = relayMatch ? routeLease : await dbConsumeVaultLeaseByKey(keyHash);
    if (!lease || !lease.secretEncrypted) {
      return refuseUpgrade(socket, 401, 'WORKING_KEY_INVALID: that key is unknown, expired, revoked, or not valid here.');
    }
    if (lease.authScheme === 'body_json') {
      return refuseUpgrade(socket, 400, 'WEBSOCKET_UNSUPPORTED: a body_json lease has no body to rewrite.');
    }
    const secret = decryptSecret(lease.secretEncrypted);

    let built: BuiltUpstreamRequest | { error: string; status: number };
    if (relayMatch) {
      built = buildUpstreamRequest({
        route: { ...lease, baseUrl: lease.baseUrl ?? '' },
        secret,
        tempKey: key,
        method: 'GET',
        url,
        headers: req.headers,
        body: null,
      });
    } else {
      const target = resolveTarget(proxyTarget(req, url), lease.baseUrl);
      if (!target) {
        return refuseUpgrade(socket, 400, 'TARGET_REQUIRED: name the vendor URL in x-octo-target, ?target=, or the path.');
      }
      built = buildProxyRequest({
        // ws(s):// names the same host as http(s)://; the upgrade headers carry the rest.
        targetUrl: target.replace(/^ws(s?):\/\//i, 'http$1://'),
        route: { ...lease, baseUrl: lease.baseUrl ?? target },
        secret,
        tempKey: key,
        headers: req.headers,
        body: null,
      });
    }
    if ('error' in built) {
      return refuseUpgrade(socket, built.status, `${built.error}: the route could not build an upstream request.`);
    }

    const forms = built.secretForms;
    const health = (status: number | 'error', detail?: string) => {
      if (!routeLease) return;
      const c = classifyUpstream(status);
      void dbUpdateVaultRouteHealth(routeLease.principalId, routeLease.routeId, c.status, detail ?? c.detail).catch(
        () => undefined
      );
    };

    const target = new URL(built.url);
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const upstream = send(target, {
      method: 'GET',
      headers: { ...built.headers, Connection: 'Upgrade', Upgrade: 'websocket' },
    });

    upstream.on('upgrade', (upRes, upSocket, upHead) => {
      health(upRes.statusCode ?? 101);
      writeHandshakeHead(socket, `HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`, upRes.rawHeaders, forms, () => true);
      if (upHead.length) socket.write(upHead);
      if (head.length) upSocket.write(head);
      socket.pipe(upSocket);
      upSocket.pipe(socket);
      const close = () => {
        socket.destroy();
        upSocket.destroy();
      };
      socket.on('close', close);
      upSocket.on('close', close);
      upSocket.on('error', close);
    });

    // The vendor refused the upgrade (401, 403, a plain page): hand that answer back.
    upstream.on('response', (upRes) => {
      health(upRes.statusCode ?? 502);
      writeHandshakeHead(
        socket,
        `HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`,
        upRes.rawHeaders,
        forms,
        (name) => !BODY_FRAMING_HEADERS.has(name),
        'Connection: close\r\n'
      );
      pipeline(upRes, createSecretScrubber(forms), socket).catch(() => socket.destroy());
    });

    upstream.on('error', (error) => {
      health('error', scrubSecrets(redactTempKeys(error.message), forms));
      refuseUpgrade(socket, 502, 'EGRESS_FAILED: the vendor did not answer.');
    });
    socket.on('close', () => upstream.destroy());
    upstream.end();
  } catch {
    refuseUpgrade(socket, 502, 'EGRESS_FAILED: the upgrade could not be relayed.');
  }
}
