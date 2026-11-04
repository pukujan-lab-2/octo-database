/**
 * A working key can revoke itself and nothing else: the route takes only the key
 * the caller holds, so an agent that leaks a key can end it without the owner.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const WORKING_KEY = 'octo_tmp_fixtureworkingkey0123456789';
const OTHER_KEY = 'octo_tmp_someoneelseskey0123456789';

const revoke = vi.fn(async (_keyHash: string) => true);

vi.mock('../../src/server/db', () => ({
  dbConsumeVaultLease: vi.fn(async () => null),
  dbConsumeVaultLeaseByKey: vi.fn(async () => null),
  dbGetVaultLeaseByKey: vi.fn(async () => null),
  dbRenewVaultLease: vi.fn(async () => null),
  dbRevokeVaultLeaseByKey: (keyHash: string) => revoke(keyHash),
  dbUpdateVaultRouteHealth: vi.fn(async () => undefined),
}));

import { handleVaultRelayRoutes } from '../../src/routes/vault-relay';
import { hashApiKeySecret } from '../../src/lib/secret-hash';

let octo: Server;
let origin = '';

beforeAll(async () => {
  octo = createServer((req, res) => {
    void handleVaultRelayRoutes(req, res, new URL(req.url ?? '/', 'http://octo.local')).then((handled) => {
      if (!handled) res.writeHead(404).end();
    });
  });
  await new Promise<void>((resolve) => octo.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(octo.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => octo.close(resolve));
});

beforeEach(() => {
  revoke.mockClear();
  revoke.mockResolvedValue(true);
});

function post(headers: Record<string, string>) {
  return fetch(`${origin}/api/vault/lease/revoke`, { method: 'POST', headers });
}

describe('POST /api/vault/lease/revoke', () => {
  it('revokes the lease of the key that made the call', async () => {
    const response = await post({ 'x-api-key': WORKING_KEY });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revoked: true });
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith(hashApiKeySecret(WORKING_KEY));
  });

  it('accepts the key as a bearer token too', async () => {
    const response = await post({ authorization: `Bearer ${WORKING_KEY}` });
    expect(response.status).toBe(200);
    expect(revoke).toHaveBeenCalledWith(hashApiKeySecret(WORKING_KEY));
  });

  it('answers 401 when the key is unknown, expired or already revoked', async () => {
    revoke.mockResolvedValue(false);
    const response = await post({ 'x-api-key': WORKING_KEY });
    expect(response.status).toBe(401);
  });

  it('answers 401 with no key and revokes nothing', async () => {
    const response = await post({});
    expect(response.status).toBe(401);
    expect(revoke).not.toHaveBeenCalled();
  });

  it('refuses two different keys rather than guessing which to revoke', async () => {
    const response = await post({ 'x-api-key': WORKING_KEY, authorization: `Bearer ${OTHER_KEY}` });
    expect(response.status).toBe(400);
    expect(revoke).not.toHaveBeenCalled();
  });
});
