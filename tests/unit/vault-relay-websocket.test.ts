/**
 * The vault proxy relays a WebSocket upgrade: the stored secret is injected into
 * the handshake, bytes flow both ways after the 101, and the secret never comes
 * back to the working-key holder. The vendor here is a bare `upgrade` listener,
 * so the test needs no WebSocket library either.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { connect, type AddressInfo, type Socket } from 'node:net';
import { createHash } from 'node:crypto';

const SECRET = 'fixture/secret+0123456789';
const WORKING_KEY = 'octo_tmp_fixtureworkingkey0123456789';

const lease = {
  leaseId: 'lease-1',
  principalId: 'p1',
  itemId: 'item-1',
  routeId: 'route-1',
  baseUrl: '',
  authScheme: 'bearer',
  authHeader: null as string | null,
  bodyField: null,
  basicUsername: null,
  itemUsername: null,
  secretEncrypted: 'encrypted',
  expiresAt: '2099-01-01T00:00:00Z',
};
let validKey = true;

vi.mock('../../src/server/db', () => ({
  dbConsumeVaultLease: vi.fn(async () => (validKey ? lease : null)),
  dbConsumeVaultLeaseByKey: vi.fn(async () => (validKey ? lease : null)),
  dbGetVaultLeaseByKey: vi.fn(async () => null),
  dbRenewVaultLease: vi.fn(async () => null),
  dbUpdateVaultRouteHealth: vi.fn(async () => undefined),
}));
vi.mock('../../src/lib/mfa', () => ({ decryptSecret: () => SECRET }));

import { handleVaultRelayUpgrade } from '../../src/routes/vault-relay';

const seen: IncomingMessage['headers'][] = [];
const seenUrls: string[] = [];
let vendor: Server;
let octo: Server;
let vendorOrigin = '';
let octoPort = 0;
// Upgraded sockets leave the http server's own bookkeeping, so close them by hand.
const sockets = new Set<Socket>();

beforeAll(async () => {
  vendor = createServer((_req, res) => {
    // A plain request is what a refused upgrade looks like to the vendor.
    res.writeHead(200, { 'content-type': 'text/plain' }).end('no upgrade');
  });
  vendor.on('upgrade', (req, socket) => {
    seen.push(req.headers);
    seenUrls.push(req.url ?? '');
    if (req.url?.startsWith('/forbidden')) {
      socket.end(`HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nx-echo-auth: ${req.headers['authorization']}\r\n\r\n`);
      return;
    }
    const accept = createHash('sha1')
      .update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\nx-echo-auth: ${req.headers['authorization']}\r\n\r\n`
    );
    socket.on('data', (chunk) => socket.write(`echo:${chunk.toString()}`));
  });
  vendor.on('connection', (socket) => sockets.add(socket));
  await new Promise<void>((resolve) => vendor.listen(0, '127.0.0.1', resolve));
  vendorOrigin = `http://127.0.0.1:${(vendor.address() as AddressInfo).port}`;

  octo = createServer((_req, res) => res.writeHead(404).end());
  octo.on('upgrade', (req, socket, head) => void handleVaultRelayUpgrade(req, socket, head));
  octo.on('connection', (socket) => sockets.add(socket));
  await new Promise<void>((resolve) => octo.listen(0, '127.0.0.1', resolve));
  octoPort = (octo.address() as AddressInfo).port;
});

afterAll(async () => {
  sockets.forEach((socket) => socket.destroy());
  await new Promise((resolve) => octo.close(resolve));
  await new Promise((resolve) => vendor.close(resolve));
});

const open: { close: () => void }[] = [];
afterEach(() => open.splice(0).forEach((conn) => conn.close()));

beforeEach(() => {
  seen.length = 0;
  seenUrls.length = 0;
  validKey = true;
  lease.baseUrl = vendorOrigin;
});

/** Sends a raw upgrade request and returns the socket plus everything read so far. */
function upgrade(path: string, extraHeaders = ''): Promise<{ head: string; send: (s: string) => Promise<string>; close: () => void }> {
  return new Promise((resolve, reject) => {
    const socket = connect(octoPort, '127.0.0.1');
    let buffer = '';
    let waiter: ((s: string) => void) | null = null;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      waiter?.(buffer);
    });
    socket.on('error', reject);
    const next = (done: (s: string) => boolean) =>
      new Promise<string>((res) => {
        waiter = (s) => {
          if (done(s)) {
            waiter = null;
            res(s);
          }
        };
        waiter(buffer);
      });
    socket.write(
      `GET ${path} HTTP/1.1\r\nHost: octo.local\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n` +
        `Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nx-api-key: ${WORKING_KEY}\r\n${extraHeaders}\r\n`
    );
    void next((s) => s.includes('\r\n\r\n') || socket.destroyed).then(async (head) => {
      buffer = buffer.slice(buffer.indexOf('\r\n\r\n') + 4);
      const conn = {
        head,
        send: (s: string) => {
          buffer = '';
          socket.write(s);
          return next((got) => got.length > 0);
        },
        close: () => socket.destroy(),
      };
      open.push(conn);
      resolve(conn);
    });
  });
}

describe.each([
  {
    name: 'proxy',
    path: (to: string) => `/api/vault/proxy?target=${encodeURIComponent(`${vendorOrigin.replace('http', 'ws')}${to}`)}`,
  },
  { name: 'relay route', path: (to: string) => `/api/vault/relay/vendor${to}` },
])('WebSocket through $name', ({ path }) => {
  it('injects the secret, relays bytes both ways, and hides the secret from the caller', async () => {
    const conn = await upgrade(path('/v1/listen'));
    expect(conn.head).toMatch(/^HTTP\/1.1 101 /);
    expect(conn.head).toContain('Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=');
    expect(seenUrls[0]).toBe('/v1/listen');
    expect(seen[0]!['authorization']).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(seen[0])).not.toContain(WORKING_KEY);
    expect(conn.head).not.toContain(SECRET);
    expect(await conn.send('hello')).toBe('echo:hello');
    conn.close();
  });

  it('passes a vendor refusal back with the secret scrubbed', async () => {
    const conn = await upgrade(path('/forbidden'));
    expect(conn.head).toMatch(/^HTTP\/1.1 403 /);
    expect(conn.head).not.toContain(SECRET);
    conn.close();
  });

  it('refuses an unknown working key without calling the vendor', async () => {
    validKey = false;
    const conn = await upgrade(path('/v1/listen'));
    expect(conn.head).toMatch(/^HTTP\/1.1 401 /);
    expect(seen).toHaveLength(0);
    conn.close();
  });
});

describe('WebSocket outside the vault', () => {
  it('refuses an upgrade on any other path', async () => {
    const conn = await upgrade('/api/files');
    expect(conn.head).toMatch(/^HTTP\/1.1 404 /);
    conn.close();
  });
});
