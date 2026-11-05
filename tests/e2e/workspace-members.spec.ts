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
import { generateSync } from 'otplib/functional';
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
  workspaceId: string,
  scope = 'read files'
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
      scope,
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

/**
 * A business admin signed in to a web app through Octo OAuth manages members with
 * the same one-time code a person gets, held for that one workspace (#82). Every
 * other API key, and every other gated action, still refuses OAuth.
 */
test.describe('Member changes from an OAuth token', () => {
  const MANAGE = 'read write delete';
  let owner: GuestSession;
  let admin: GuestSession;
  let reader: GuestSession;
  const membersPath = () => `/api/workspaces/${owner.workspace.id}/members`;
  const challengePath = (workspaceId: string) => `/api/workspaces/${workspaceId}/members/confirm-challenge`;

  test.beforeAll(async ({ request }) => {
    owner = await createGuest(request, 'oauth-owner');
    admin = await createGuest(request, 'oauth-admin');
    reader = await createGuest(request, 'oauth-reader');
    await setConfirmSecret(request, owner.sessionToken);
    for (const [person, role] of [[admin, 'admin'], [reader, 'member']] as const) {
      const added = await request.post(`/api/workspaces/${owner.workspace.id}/members`, {
        headers: bearer(owner.sessionToken),
        data: { email: person.principal.email, role, confirmSecret: CONFIRM_SECRET },
      });
      expect(added.status()).toBe(201);
    }
  });

  test("an admin's OAuth token adds and removes a member with a typed code, and only then", async ({ request }) => {
    const web = await webClientSignIn(request, admin, owner.workspace.id, MANAGE);
    const headers = bearer(web.access_token);
    const email = `oauth-added-${randomUUID()}@example.com`;

    const noCode = await request.post(membersPath(), { headers, data: { email } });
    expect(noCode.status()).toBe(403);
    expect(await noCode.text()).toContain('CONFIRM_CODE_INVALID');

    const asked = await request.post(challengePath(owner.workspace.id), { headers });
    expect(asked.status()).toBe(200);
    const issued = (await asked.json()) as { code: string; expiresAt: string; mfaRequired: boolean };
    expect(issued.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(issued.mfaRequired).toBe(false);

    const wrong = await request.post(membersPath(), { headers, data: { email, confirmSecret: 'AAAAAA' } });
    expect(wrong.status()).toBe(403);
    // A wrong guess does not burn the code.
    const added = await request.post(membersPath(), { headers, data: { email, confirmSecret: issued.code } });
    expect(added.status()).toBe(202);
    // Single use, and no fifteen-minute window: the next change needs a new code.
    const again = await request.delete(membersPath(), { headers, data: { email, confirmSecret: issued.code } });
    expect(again.status()).toBe(403);

    const second = (await (await request.post(challengePath(owner.workspace.id), { headers })).json()) as { code: string };
    const removed = await request.delete(membersPath(), { headers, data: { email, confirmSecret: second.code } });
    expect(removed.status()).toBe(200);
  });

  test("a member's OAuth token cannot ask for a code or change members", async ({ request }) => {
    const web = await webClientSignIn(request, reader, owner.workspace.id, MANAGE);
    const headers = bearer(web.access_token);
    expect((await request.post(challengePath(owner.workspace.id), { headers })).status()).toBe(403);
    const add = await request.post(membersPath(), {
      headers,
      data: { email: `x-${randomUUID()}@example.com`, confirmSecret: 'AAAAAA' },
    });
    expect(add.status()).toBe(403);
  });

  test('a code is good for one workspace, and a token for its own workspace only', async ({ request }) => {
    const here = await webClientSignIn(request, admin, owner.workspace.id, MANAGE);
    const ownSandbox = await webClientSignIn(request, admin, admin.workspace.id, MANAGE);

    // The token bound to the owner's workspace is refused on the admin's own sandbox.
    expect((await request.post(challengePath(admin.workspace.id), { headers: bearer(here.access_token) })).status()).toBe(403);

    // A code issued in the sandbox does not confirm a change in the owner's workspace.
    const sandboxCode = (await (
      await request.post(challengePath(admin.workspace.id), { headers: bearer(ownSandbox.access_token) })
    ).json()) as { code: string };
    const crossed = await request.post(membersPath(), {
      headers: bearer(here.access_token),
      data: { email: `y-${randomUUID()}@example.com`, confirmSecret: sandboxCode.code },
    });
    expect(crossed.status()).toBe(403);
  });

  test('other API keys and other gated actions still refuse', async ({ request }) => {
    // A workspace key cannot ask for a member code.
    const minted = await request.post('/api/keys', {
      headers: bearer(owner.sessionToken),
      data: { name: `oauth-gate ${randomUUID()}`, workspaceId: owner.workspace.id, scopes: ['read', 'write', 'delete'], confirmSecret: CONFIRM_SECRET },
    });
    expect(minted.status()).toBe(201);
    const { rawSecret } = (await minted.json()) as { rawSecret: string };
    expect((await request.post(challengePath(owner.workspace.id), { headers: bearer(rawSecret) })).status()).toBe(403);

    // A session asks at /api/me/confirm-challenge, not here.
    expect((await request.post(challengePath(owner.workspace.id), { headers: bearer(owner.sessionToken) })).status()).toBe(403);

    // The admin's OAuth token, holding a live member code, still cannot mint a key.
    const web = await webClientSignIn(request, admin, owner.workspace.id, MANAGE);
    const code = (await (
      await request.post(challengePath(owner.workspace.id), { headers: bearer(web.access_token) })
    ).json()) as { code: string };
    const mint = await request.post('/api/keys', {
      headers: bearer(web.access_token),
      data: { name: 'nope', workspaceId: owner.workspace.id, scopes: ['read'], confirmSecret: code.code },
    });
    expect(mint.status()).toBe(403);
  });

  test('an admin with MFA also needs a current authenticator code', async ({ request }) => {
    const mfaAdmin = await createGuest(request, 'oauth-mfa-admin');
    const added = await request.post(membersPath(), {
      headers: bearer(owner.sessionToken),
      data: { email: mfaAdmin.principal.email, role: 'admin', confirmSecret: CONFIRM_SECRET },
    });
    expect(added.status()).toBe(201);
    const begun = (await (
      await request.post('/api/me/mfa/begin', { headers: bearer(mfaAdmin.sessionToken) })
    ).json()) as { secret: string };
    const confirmed = await request.post('/api/me/mfa/confirm', {
      headers: bearer(mfaAdmin.sessionToken),
      data: { code: generateSync({ secret: begun.secret }) },
    });
    expect(confirmed.status()).toBe(200);

    const web = await webClientSignIn(request, mfaAdmin, owner.workspace.id, MANAGE);
    const headers = bearer(web.access_token);
    const email = `mfa-added-${randomUUID()}@example.com`;
    const first = (await (await request.post(challengePath(owner.workspace.id), { headers })).json()) as {
      code: string;
      mfaRequired: boolean;
    };
    expect(first.mfaRequired).toBe(true);
    const withoutTotp = await request.post(membersPath(), { headers, data: { email, confirmSecret: first.code } });
    expect(withoutTotp.status()).toBe(403);
    expect(await withoutTotp.text()).toContain('MFA_CODE_INVALID');

    const next = (await (await request.post(challengePath(owner.workspace.id), { headers })).json()) as { code: string };
    const withTotp = await request.post(membersPath(), {
      headers,
      data: { email, confirmSecret: next.code, mfaCode: generateSync({ secret: begun.secret }) },
    });
    expect(withTotp.status()).toBe(202);
  });
});
