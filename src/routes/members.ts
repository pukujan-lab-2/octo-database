/**
 * Workspace members: list, add or change, and remove, by Google email (#82).
 *
 * The owner or an admin manages who else belongs to a workspace. A person is named
 * by the email they sign in with. If nobody has signed in with it yet, the addition
 * waits and becomes a membership at their first Google sign-in (src/routes/auth.ts).
 * Adding and removing are confirm-gated, like minting a key: they change who can
 * reach the workspace. Each change is written to the workspace's activity log.
 *
 * One route family, dispatched by src/server/index.ts. Returns true when this
 * family handled the request.
 */

import { OctoScope } from '../api/capabilities';
import { WorkspaceRole } from '../types/auth';
import { authenticateRequest, effectiveWorkspaceRole, keyWorkspaceMatches, requireScope, roleMeetsMinimum, scopeDenied } from '../server/auth-context';
import { confirmGate } from '../server/confirm';
import { dbFindPrincipalByEmail, dbGetWorkspaceMembership, dbInsertMembership, dbListWorkspaceMembers, dbRecordActivity, dbRemoveWorkspaceMember, dbUpsertWorkspaceInvite } from '../server/db';
import { readJsonObject, sendJson } from '../server/http';
import { UUID_PATTERN } from '../server/runtime';
import { IncomingMessage, ServerResponse } from 'http';

const MEMBERS_PATH = /^\/api\/workspaces\/([^/]+)\/members$/;
/** Roles this route may grant. Ownership is never handed out here. */
const GRANTABLE_ROLES: WorkspaceRole[] = ['admin', 'operator', 'member'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleMembersRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<boolean> {
  const match = MEMBERS_PATH.exec(url.pathname);
  if (!match) return false;
  const scope: OctoScope | null =
    req.method === 'GET' ? 'read' : req.method === 'POST' ? 'write' : req.method === 'DELETE' ? 'delete' : null;
  if (!scope) return false;

  const auth = await authenticateRequest(req);
  if (!auth) {
    sendJson(res, 401, { error: 'UNAUTHENTICATED' });
    return true;
  }
  const workspaceId = match[1]!;
  if (!UUID_PATTERN.test(workspaceId)) {
    sendJson(res, 400, { error: 'BAD_REQUEST: workspaceId must be a valid UUID' });
    return true;
  }
  if (!requireScope(auth, scope)) {
    scopeDenied(res, scope);
    return true;
  }
  if (!keyWorkspaceMatches(auth, workspaceId)) {
    sendJson(res, 403, { error: 'FORBIDDEN: Key restricted to different workspace' });
    return true;
  }
  const mem = await dbGetWorkspaceMembership(workspaceId, auth.principal.id);
  if (!mem) {
    sendJson(res, 403, { error: 'FORBIDDEN: Not a member of this workspace' });
    return true;
  }
  const callerRole = effectiveWorkspaceRole(auth, mem.role);
  if (!roleMeetsMinimum(callerRole, 'admin')) {
    sendJson(res, 403, { error: 'FORBIDDEN: Owner or admin role required to manage members' });
    return true;
  }

  // GET /api/workspaces/:id/members
  if (req.method === 'GET') {
    sendJson(res, 200, await dbListWorkspaceMembers(workspaceId));
    return true;
  }

  const parsed = await readJsonObject(req);
  if (!(await confirmGate(res, auth, parsed.confirmSecret, { requireMfa: true, mfaCode: parsed.mfaCode })))
    return true;

  const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
  if (!EMAIL_PATTERN.test(email)) {
    sendJson(res, 400, { error: 'BAD_REQUEST: email must be an email address' });
    return true;
  }
  const target = await dbFindPrincipalByEmail(email);
  const targetMem = target ? await dbGetWorkspaceMembership(workspaceId, target.id) : null;
  // A caller may not touch the owner, nor anyone ranked above themself.
  if (targetMem && (targetMem.role === 'owner' || !roleMeetsMinimum(callerRole, targetMem.role as WorkspaceRole))) {
    sendJson(res, 403, { error: `FORBIDDEN: Cannot change a member whose role is ${targetMem.role}` });
    return true;
  }

  // POST /api/workspaces/:id/members  { email, role? }  adds, or changes the role.
  if (req.method === 'POST') {
    const role = (parsed.role ?? 'member') as WorkspaceRole;
    if (!GRANTABLE_ROLES.includes(role)) {
      sendJson(res, 400, { error: `BAD_REQUEST: role must be one of ${GRANTABLE_ROLES.join(', ')}` });
      return true;
    }
    if (!roleMeetsMinimum(callerRole, role)) {
      sendJson(res, 403, { error: `FORBIDDEN: Cannot grant a role above your own (${callerRole})` });
      return true;
    }
    if (!target) {
      const invite = await dbUpsertWorkspaceInvite(workspaceId, email, role, auth.principal.id);
      await dbRecordActivity(workspaceId, 'member.invited', `Added ${email} as ${role}, pending first sign-in`, null, auth.principal.id, { email, role });
      sendJson(res, 202, { status: 'pending', pending: invite });
      return true;
    }
    await dbInsertMembership(workspaceId, target.id, role);
    const status = targetMem ? 'updated' : 'added';
    await dbRecordActivity(workspaceId, `member.${status}`, `${status === 'added' ? 'Added' : 'Changed'} ${email} as ${role}`, null, auth.principal.id, { email, role, principalId: target.id });
    sendJson(res, status === 'added' ? 201 : 200, {
      status,
      member: { principalId: target.id, email: target.email, displayName: target.displayName, role },
    });
    return true;
  }

  // DELETE /api/workspaces/:id/members  { email }
  const removed = await dbRemoveWorkspaceMember(workspaceId, email);
  if (!removed.membershipRemoved && !removed.inviteRemoved) {
    sendJson(res, 404, { error: 'MEMBER_NOT_FOUND' });
    return true;
  }
  await dbRecordActivity(workspaceId, 'member.removed', `Removed ${email}`, null, auth.principal.id, { email, ...removed });
  sendJson(res, 200, { removed: true, email, ...removed });
  return true;
}
