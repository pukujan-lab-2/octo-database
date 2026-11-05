/**
 * Playwright E2E: workspace members by email (#82).
 *
 * The owner adds a second person to their workspace as a read-only `member`, lists
 * the members, and removes them. The member can read but not write. A web app (not
 * an MCP client) signs the member in through Octo's OAuth server and learns from
 * `GET /api/me` who they are and their role in the workspace the token is bound to.
 * Removing the member ends that token's access on its next request, and its refresh
 * token is revoked. An email nobody has signed in with waits as pending and becomes
 * a membership at first sign-in.
 *
 * Guests stand in for Google accounts: the routes find a person by the email on
 * their principal, which for a guest is its `@octo.local` address.
 */

import { expect, test, APIRequestContext } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { dbClaimWorkspaceInvites, queryService } from '../../src/server/db';
import { CONFIRM_SECRET, setConfirmSecret } from './confirm-secret';

const WEB_REDIRECT_URI = 'https://copilot.example.com/auth/octo/callback';
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

interface GuestSession {
  principal: { id: string; email: string };
  workspace: { id: string };
  sessionToken: string;
}

async function createGuest(request: APIRequestContext, label: string): Promise<GuestSession> {
  const response = await request.post('/api/auth/guest', {
    data: { displayName: `Members ${label} ${randomUUID()}` },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as GuestSession;
}

/** A web app's sign-in: register, authorize with PKCE for one workspace, exchange the code. */
async function webClientSignIn(
  request: APIRequestContext,
  person: GuestSession,
  workspaceId: string
): Promise<{ access_token: string; refresh_token: string; clientId: string }> {
  const registered = await request.post('/oauth/register', {
    data: { client_name: 'Copilot web app', redirect_uris: [WEB_REDIRECT_URI] },
  });
  expect(registered.status()).toBe(201);
  const clientId = ((await registered.json()) as { client_id: string }).client_id;

  const { resource } = (await (await request.get('/.well-known/oauth-protected-resource')).json()) as {
    resource: string;
  };
  const verifier = (randomUUID() + randomUUID()).replace(/-/g, '');
  const challenge = createHash('sha256').update(verifier).digest('base64url');

  const consent = await request.post('/oauth/authorize', {
    headers: bearer(person.sessionToken),
    form: {
      client_id: clientId,
      redirect_uri: WEB_REDIRECT_URI,
      scope: 'read files',
      state: 'web-state',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource,
      workspace_id: workspaceId,
    },
    maxRedirects: 0,
  });
  expect(consent.status()).toBe(302);
  const code = new URL(consent.headers()['location']!).searchParams.get('code');
  expect(code).toBeTruthy();

  const token = await request.post('/oauth/token', {
    form: {
      grant_type: 'authorization_code',
      code: code!,
      redirect_uri: WEB_REDIRECT_URI,
      client_id: clientId,
      code_verifier: verifier,
    },
  });
  expect(token.status()).toBe(200);
  return { ...((await token.json()) as { access_token: string; refresh_token: string }), clientId };
}

test.describe('Workspace members', () => {
  let owner: GuestSession;
  let reader: GuestSession;
  const membersPath = () => `/api/workspaces/${owner.workspace.id}/members`;

  test.beforeAll(async ({ request }) => {
    owner = await createGuest(request, 'owner');
    reader = await createGuest(request, 'reader');
    await setConfirmSecret(request, owner.sessionToken);
  });

  test('add, list, read-only role, web sign-in, and removal ending access at once', async ({ request }) => {
    // Add the reader as a read-only member.
    const added = await request.post(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email: reader.principal.email.toUpperCase(), role: 'member', confirmSecret: CONFIRM_SECRET },
    });
    expect(added.status()).toBe(201);
    const addedBody = (await added.json()) as { status: string; member: { principalId: string; role: string } };
    expect(addedBody.status).toBe('added');
    expect(addedBody.member).toMatchObject({ principalId: reader.principal.id, role: 'member' });

    const list = await request.get(membersPath(), { headers: bearer(owner.sessionToken) });
    expect(list.status()).toBe(200);
    const listed = (await list.json()) as { members: { principalId: string; role: string }[] };
    expect(listed.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ principalId: owner.principal.id, role: 'owner' }),
        expect.objectContaining({ principalId: reader.principal.id, role: 'member' }),
      ])
    );

    // The member reads, and every write is refused.
    const readFiles = await request.get(`/api/files?workspaceId=${owner.workspace.id}`, {
      headers: bearer(reader.sessionToken),
    });
    expect(readFiles.status()).toBe(200);
    const upload = await request.post('/api/files/upload', {
      headers: bearer(reader.sessionToken),
      data: { workspaceId: owner.workspace.id, name: 'nope.txt', data: 'aGk=', dataEncoding: 'base64' },
    });
    expect(upload.status()).toBe(403);
    await setConfirmSecret(request, reader.sessionToken);
    const readerAdds = await request.post(membersPath(), {
      headers: bearer(reader.sessionToken),
      data: { email: `someone-${randomUUID()}@example.com`, confirmSecret: CONFIRM_SECRET },
    });
    expect(readerAdds.status()).toBe(403);
    expect((await request.get(membersPath(), { headers: bearer(reader.sessionToken) })).status()).toBe(403);

    // A web app signs the member in and asks who they are in the bound workspace.
    const web = await webClientSignIn(request, reader, owner.workspace.id);
    const me = await request.get('/api/me', { headers: bearer(web.access_token) });
    expect(me.status()).toBe(200);
    const meBody = (await me.json()) as {
      principal: { id: string; email: string };
      workspace: { id: string; role: string | null };
    };
    expect(meBody.principal.id).toBe(reader.principal.id);
    expect(meBody.principal.email).toBe(reader.principal.email);
    expect(meBody.workspace).toEqual({ id: owner.workspace.id, role: 'member' });
    expect(
      (await request.get(`/api/files?workspaceId=${owner.workspace.id}`, { headers: bearer(web.access_token) })).status()
    ).toBe(200);

    // Remove the member.
    const removed = await request.delete(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email: reader.principal.email, confirmSecret: CONFIRM_SECRET },
    });
    expect(removed.status()).toBe(200);
    expect(await removed.json()).toMatchObject({ removed: true, membershipRemoved: true });

    // The same access token, the session and the refresh token all stop at once.
    expect(
      (await request.get(`/api/files?workspaceId=${owner.workspace.id}`, { headers: bearer(web.access_token) })).status()
    ).toBe(403);
    expect(
      (await request.get(`/api/files?workspaceId=${owner.workspace.id}`, { headers: bearer(reader.sessionToken) })).status()
    ).toBe(403);
    const meAfter = (await (await request.get('/api/me', { headers: bearer(web.access_token) })).json()) as {
      workspace: { id: string; role: string | null };
    };
    expect(meAfter.workspace).toEqual({ id: owner.workspace.id, role: null });
    const refresh = await request.post('/oauth/token', {
      form: { grant_type: 'refresh_token', refresh_token: web.refresh_token, client_id: web.clientId },
    });
    expect(refresh.status()).toBe(400);

    const listAfter = (await (await request.get(membersPath(), { headers: bearer(owner.sessionToken) })).json()) as {
      members: { principalId: string }[];
    };
    expect(listAfter.members.map((m) => m.principalId)).not.toContain(reader.principal.id);
  });

  test('an email nobody has signed in with waits and joins at first sign-in', async ({ request }) => {
    const email = `new-reader-${randomUUID()}@example.com`;
    const pending = await request.post(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email, role: 'member', confirmSecret: CONFIRM_SECRET },
    });
    expect(pending.status()).toBe(202);
    expect(await pending.json()).toMatchObject({ status: 'pending', pending: { email, role: 'member' } });
    const listed = (await (await request.get(membersPath(), { headers: bearer(owner.sessionToken) })).json()) as {
      pending: { email: string }[];
    };
    expect(listed.pending.map((p) => p.email)).toContain(email);

    // First Google sign-in: the callback creates the principal, then claims the
    // additions for its verified email. The callback needs Google, so this drives
    // the same two steps directly.
    const authUserId = randomUUID();
    const [principal] = await queryService<{ id: string }>(
      `INSERT INTO octo.principals (id, auth_user_id, email, display_name, is_guest)
       VALUES (gen_random_uuid(), $1, $2, 'New Reader', false) RETURNING id`,
      [authUserId, email]
    );
    try {
      const joined = await dbClaimWorkspaceInvites(principal!.id, email);
      expect(joined).toEqual([{ workspaceId: owner.workspace.id, role: 'member' }]);
      const after = (await (await request.get(membersPath(), { headers: bearer(owner.sessionToken) })).json()) as {
        members: { principalId: string; role: string }[];
        pending: { email: string }[];
      };
      expect(after.members).toContainEqual(expect.objectContaining({ principalId: principal!.id, role: 'member' }));
      expect(after.pending.map((p) => p.email)).not.toContain(email);
    } finally {
      await queryService('DELETE FROM octo.principals WHERE id = $1', [principal!.id]);
    }
  });

  test('the owner cannot be changed or removed here, and API keys never confirm', async ({ request }) => {
    const owned = await request.delete(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email: owner.principal.email, confirmSecret: CONFIRM_SECRET },
    });
    expect(owned.status()).toBe(403);
    const grantOwner = await request.post(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email: `x-${randomUUID()}@example.com`, role: 'owner', confirmSecret: CONFIRM_SECRET },
    });
    expect(grantOwner.status()).toBe(400);

    const minted = await request.post('/api/keys', {
      headers: bearer(owner.sessionToken),
      data: {
        name: `members ${randomUUID()}`,
        workspaceId: owner.workspace.id,
        scopes: ['read', 'write', 'files', 'delete'],
        confirmSecret: CONFIRM_SECRET,
      },
    });
    expect(minted.status()).toBe(201);
    const { rawSecret } = (await minted.json()) as { rawSecret: string };
    const byKey = await request.post(membersPath(), {
      headers: bearer(rawSecret),
      data: { email: `y-${randomUUID()}@example.com`, confirmSecret: CONFIRM_SECRET },
    });
    expect(byKey.status()).toBe(403);
  });
});
