/**
 * Open the Phoenix trace viewer with the Octo session, no second login (#445).
 *
 *   POST /api/phoenix/session  a signed-in platform owner's session sets a signed,
 *                              expiring cookie scoped to /phoenix.
 *   GET  /api/phoenix/auth     the web server's forward-auth check for /phoenix/*:
 *                              200 when the cookie is valid and its principal is still
 *                              the platform owner, 401 otherwise. On 200 the web server
 *                              adds Phoenix's own admin token and forwards.
 *
 * Phoenix shows every workspace's project, so only the platform owner gets the
 * viewer this way. Other members read their own workspace through
 * /api/workspaces/:id/otel/read/* instead (#442).
 */

import { signViewerToken, verifyViewerToken, viewerTtlSeconds } from '../lib/session-token';
import { authenticateRequest } from '../server/auth-context';
import { dbIsPlatformOwner } from '../server/db';
import { sendJson } from '../server/http';
import type { IncomingMessage, ServerResponse } from 'http';

const COOKIE = 'octo_phoenix';

function cookieValue(req: IncomingMessage): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=') || null;
  }
  return null;
}

export async function handlePhoenixSessionRoutes(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  const pathname = url.pathname;

  if (pathname === '/api/phoenix/session' && req.method === 'POST') {
    const auth = await authenticateRequest(req);
    if (!auth) {
      sendJson(res, 401, { error: 'UNAUTHENTICATED' });
      return true;
    }
    if (auth.apiKey) {
      sendJson(res, 403, { error: 'FORBIDDEN: an API key cannot open the viewer. Sign in as a person.' });
      return true;
    }
    if (!auth.principal.isPlatformOwner) {
      sendJson(res, 403, {
        error: 'FORBIDDEN: only the platform owner opens the Phoenix viewer. Read a workspace\'s traces with read_traces.',
      });
      return true;
    }
    const ttl = viewerTtlSeconds();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `${COOKIE}=${signViewerToken(auth.principal.id, ttl)}; Path=/phoenix; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`,
    });
    res.end(JSON.stringify({ url: '/phoenix/' }));
    return true;
  }

  if (pathname === '/api/phoenix/auth' && req.method === 'GET') {
    const token = cookieValue(req);
    const principalId = token ? verifyViewerToken(token) : null;
    if (!principalId || !(await dbIsPlatformOwner(principalId))) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Open Phoenix from Octo: Services, Traces and evals.');
      return true;
    }
    res.writeHead(200);
    res.end();
    return true;
  }

  return false;
}
