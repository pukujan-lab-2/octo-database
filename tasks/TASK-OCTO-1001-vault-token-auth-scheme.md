# TASK-OCTO-1001 — Vault Token Auth Scheme

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Vault token auth scheme (Authorization: Token <key>) so Deepgram works through the proxy","id":"OCTO-1001","issue_url":"https://github.com/pukujan-lab-2/octo-database/issues/74","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"Pukujan","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Deepgram rejects bearer; needed for the nurse-screen phone agent STT via Octo vault"} -->

- Status: active
- Owner: Pukujan
- Priority: P1
- Depends on: none

## Goal

Vault token auth scheme (Authorization: Token <key>) so Deepgram works through the proxy

## Why

Deepgram rejects bearer; needed for the nurse-screen phone agent STT via Octo vault

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

### 2026-11-04 18:02:05 UTC — claude-code/58e50d68-210a-4d5f-aebb-83960b0e6e81

<!-- continuity:checkpoint {"agent":"claude-code/58e50d68-210a-4d5f-aebb-83960b0e6e81","blocked":[],"changed":["src/lib/vault-policy.ts, src/lib/relay-egress.ts, db/migrations/20261104180000_vault_token_auth_scheme.sql, frontend scheme lists, docs, tests"],"completed":["token auth scheme in policy, relay egress, migration, UI and docs; tests added"],"decisions":["no new decisions"],"evidence":["vitest 84 passed; pytest schema 10 passed; tsc clean; ruff clean"],"next_action":"wait for gates on PR 71 to pass and auto-merge; then promote to production and test Deepgram through the proxy","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1001","timestamp":"2026-11-04T18:02:05Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2dceb8bcd142e66d84b206f5db6463893d3b9618324960c219ad34d641d70417","request_id":"2a267828d8f84203a07cea5e1ef66063","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1001"} -->

Completed:
- token auth scheme in policy, relay egress, migration, UI and docs; tests added

Evidence:
- vitest 84 passed; pytest schema 10 passed; tsc clean; ruff clean

Decisions:
- no new decisions

Changed:
- src/lib/vault-policy.ts, src/lib/relay-egress.ts, db/migrations/20261104180000_vault_token_auth_scheme.sql, frontend scheme lists, docs, tests

Blocked/uncertain:
- none

Next:
- wait for gates on PR 71 to pass and auto-merge; then promote to production and test Deepgram through the proxy

### 2026-11-04 18:02:10 UTC — claude-code/58e50d68-210a-4d5f-aebb-83960b0e6e81

<!-- continuity:checkpoint {"agent":"claude-code/58e50d68-210a-4d5f-aebb-83960b0e6e81","blocked":[],"changed":["src/lib/vault-policy.ts, src/lib/relay-egress.ts, db/migrations/20261104180000_vault_token_auth_scheme.sql, frontend scheme lists, docs, tests"],"completed":["token auth scheme in policy, relay egress, migration, UI and docs; tests added"],"decisions":["no new decisions"],"evidence":["vitest 84 passed; pytest schema 10 passed; tsc clean; ruff clean"],"next_action":"wait for gates on PR 71 to pass and auto-merge; then promote to production and test Deepgram through the proxy","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1001","timestamp":"2026-11-04T18:02:10Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2dceb8bcd142e66d84b206f5db6463893d3b9618324960c219ad34d641d70417","request_id":"70e651a372474be7aa480f7fbd881c92","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1001"} -->

Completed:
- token auth scheme in policy, relay egress, migration, UI and docs; tests added

Evidence:
- vitest 84 passed; pytest schema 10 passed; tsc clean; ruff clean

Decisions:
- no new decisions

Changed:
- src/lib/vault-policy.ts, src/lib/relay-egress.ts, db/migrations/20261104180000_vault_token_auth_scheme.sql, frontend scheme lists, docs, tests

Blocked/uncertain:
- none

Next:
- wait for gates on PR 71 to pass and auto-merge; then promote to production and test Deepgram through the proxy

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
