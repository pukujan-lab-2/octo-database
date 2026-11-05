# TASK-OCTO-1002 — Workspace Members

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Let a workspace owner or admin add, list and remove members by Google email, with a read-only role","id":"OCTO-1002","issue_url":"https://github.com/pukujan-lab-2/octo-database/issues/82","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"Pukujan","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"voice-agent-research#131 needs business staff to reach raw calls only as members of the business's Octo workspace"} -->

- Status: active
- Owner: Pukujan
- Priority: P1
- Depends on: none

## Goal

Let a workspace owner or admin add, list and remove members by Google email, with a read-only role

## Why

voice-agent-research#131 needs business staff to reach raw calls only as members of the business's Octo workspace

## Allowed files

- define bounded paths before implementation.

## Human outcome

Describe what becomes easier, safer, clearer, or possible when this task is complete.

## Scope and boundaries

- In scope:
- Out of scope:
- Dependencies/uncertainty:

## Acceptance criteria

- [ ] state observable, task-specific outcomes.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none):
- Primary writer / branch / source issue revision / as-of status:
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-05 00:14:02 UTC — agent:claude-code/8c489413-ecde-4c9a-82c4-1a8b8ec43c16

<!-- continuity:checkpoint {"agent":"agent:claude-code/8c489413-ecde-4c9a-82c4-1a8b8ec43c16","blocked":[],"changed":["src/routes/members.ts, src/server/db.ts, src/routes/auth.ts, src/routes/me.ts, db/migrations/20261104210000_workspace_invites.sql, docs/ARCHITECTURE.md, tests/e2e/workspace-members.spec.ts"],"completed":["Member routes GET/POST/DELETE /api/workspaces/:id/members, pending additions claimed at first verified Google sign-in, /api/me returns the live role for a workspace-bound token, docs and e2e tests"],"decisions":["no new decisions"],"evidence":["Local runs: workspace-members + oauth-mcp specs 14 passed, route-isolation/workspace-lifecycle/session-token 471 passed, vitest 883 passed, Python schema tests 138 passed, typecheck and lint:imports clean"],"next_action":"Wait for gates on PR #83 to pass and auto-merge; then voice-agent-research#131 builds on the API","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1002","timestamp":"2026-11-05T00:14:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"1e55bd59870d2b6833fc73d4b8664202fb267059d1c58f3c84633ca8911b241c","request_id":"20b103de73294165bbf22bfb66302792","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1002"} -->

Completed:
- Member routes GET/POST/DELETE /api/workspaces/:id/members, pending additions claimed at first verified Google sign-in, /api/me returns the live role for a workspace-bound token, docs and e2e tests

Evidence:
- Local runs: workspace-members + oauth-mcp specs 14 passed, route-isolation/workspace-lifecycle/session-token 471 passed, vitest 883 passed, Python schema tests 138 passed, typecheck and lint:imports clean

Decisions:
- no new decisions

Changed:
- src/routes/members.ts, src/server/db.ts, src/routes/auth.ts, src/routes/me.ts, db/migrations/20261104210000_workspace_invites.sql, docs/ARCHITECTURE.md, tests/e2e/workspace-members.spec.ts

Blocked/uncertain:
- none

Next:
- Wait for gates on PR #83 to pass and auto-merge; then voice-agent-research#131 builds on the API

### 2026-11-05 00:33:32 UTC — agent:claude-code/8c489413-ecde-4c9a-82c4-1a8b8ec43c16

<!-- continuity:checkpoint {"agent":"agent:claude-code/8c489413-ecde-4c9a-82c4-1a8b8ec43c16","blocked":[],"changed":["src/routes/members.ts, src/server/confirm.ts, src/server/auth-context.ts, tests/e2e/workspace-members.spec.ts, tests/e2e/route-table.ts, docs/ARCHITECTURE.md"],"completed":["Promoted members to production (PR 85, live image ba05387, GET members answers 200); OAuth admin tokens pass the member routes' gate with a per-workspace one-time code plus TOTP"],"decisions":["no new decisions"],"evidence":["Local: workspace-members, route-isolation, oauth-mcp, confirm-code specs 491 passed; vitest 883 passed; Python 138 passed; typecheck and lint:imports clean"],"next_action":"Merge the OAuth member-confirm PR when gates passes, then promote it to production","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1002","timestamp":"2026-11-05T00:33:32Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"5375205b383914e8c2e3067c0122e2209ff6658856aa71730a66bd4571ad6fcc","request_id":"4982ad71a3904b2f97a4fdce228b5937","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1002"} -->

Completed:
- Promoted members to production (PR 85, live image ba05387, GET members answers 200); OAuth admin tokens pass the member routes' gate with a per-workspace one-time code plus TOTP

Evidence:
- Local: workspace-members, route-isolation, oauth-mcp, confirm-code specs 491 passed; vitest 883 passed; Python 138 passed; typecheck and lint:imports clean

Decisions:
- no new decisions

Changed:
- src/routes/members.ts, src/server/confirm.ts, src/server/auth-context.ts, tests/e2e/workspace-members.spec.ts, tests/e2e/route-table.ts, docs/ARCHITECTURE.md

Blocked/uncertain:
- none

Next:
- Merge the OAuth member-confirm PR when gates passes, then promote it to production

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
