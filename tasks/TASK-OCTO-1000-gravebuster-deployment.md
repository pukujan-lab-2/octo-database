# OCTO-1000 Host Octo on gravebuster with a production branch and gated CI/CD

<!-- continuity:task {"acceptance":["octodb.design-bakery.com serves the Octo UI over HTTPS","Google sign-in completes and lands on an authenticated dashboard","guest login still works","a merge to main does not deploy; a merge to production deploys within 5 minutes","a failing smoke test rolls back to the previous image automatically","gates runs on pull requests into both main and production","no secret is committed to the repository"],"depends_on":["OCTO-0100"],"goal":"Host Octo's frontend and backend as containers on gravebuster with a gated promotion path to production","id":"OCTO-1000","issue_url":"https://github.com/Pukujan-lab/octo-database/issues/43","next_action":"Create pull request with auto-merge to main for deployment hardening fixes.","owner":"Pukujan; main agent coordinates implementation","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Octo has no hosted instance and no delivery path from a merged commit to a running service."} -->

- Status: active
- Priority: P1
- Branch: `task/OCTO-1000-gravebuster-hosting`
- GitHub issue: https://github.com/Pukujan-lab/octo-database/issues/43
- Design spec: `docs/superpowers/specs/2026-10-01-octo-gravebuster-deployment-design.md`

## Goal

Host Octo on gravebuster at `octodb.design-bakery.com`, with a CI/CD path that
cannot break the running service and a `production` branch the owner promotes to.

## Blocking defects this work must fix

1. `src/server/index.ts:465` sends users to Google with a callback redirect URI,
   but no `/api/auth/google/callback` route exists — Google sign-in is broken.
2. `src/server/index.ts` is API-only; nothing serves the Vite `dist/` build.
3. `url.origin` (line 436) derives from a hardcoded `http://localhost:${PORT}`
   base, so the redirect URI is wrong behind the tunnel.
4. The server reads `GOOGLE_OAUTH_CLIENT_ID`/`_SECRET`; the repo `.env` defines
   `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`.

## Owner-confirmed decisions

Dedicated Postgres container; keep `main`, add `production`; promotion via a PR
from `main` merged by the owner; pull-based systemd deploy timer; secrets copied
to gravebuster over SSH; Podman for the WSL test stack; reuse the existing Google
client and implement the missing callback.

## Owner actions required

- Add `https://octodb.design-bakery.com/api/auth/google/callback` as an authorized
  redirect URI on the existing Google OAuth client.
- Add the tunnel hostname in the Zero Trust dashboard; the repo's Cloudflare
  tokens both fail `/user/tokens/verify` with error code 1000.
- Confirm port 8090 is free on gravebuster.

## Not in scope

Schema-migration tooling for a live database, scale-out (Issue #14), rotating the
expired Cloudflare tokens.

## Checkpoint log

### 2026-10-01 08:00:00 UTC — Pukujan

<!-- continuity:checkpoint {"agent":"Pukujan","blocked":[],"changed":["docs/superpowers/specs/2026-10-01-octo-gravebuster-deployment-design.md"],"completed":["Design spec for hosting Octo on gravebuster with gated CI/CD"],"decisions":["Dedicated Postgres container on gravebuster","Keep main, add production branch promoted by owner PR","Pull-based systemd deploy timer polling origin/production"],"evidence":["PR #44 merged with green gates"],"next_action":"Owner reviews deployment design spec and begins implementation","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-10-01T08:00:00Z"} -->

Completed:
- Design spec for hosting Octo on gravebuster with gated CI/CD

Evidence:
- PR #44 merged with green gates

Decisions:
- Dedicated Postgres container on gravebuster
- Keep main, add production branch promoted by owner PR
- Pull-based systemd deploy timer polling origin/production

Changed:
- docs/superpowers/specs/2026-10-01-octo-gravebuster-deployment-design.md

Blocked/uncertain:
- none

Next:
- Owner reviews deployment design spec and begins implementation

### 2026-10-01 19:40:00 UTC — Pukujan

<!-- continuity:checkpoint {"agent":"Pukujan","blocked":[],"changed":["AGENTS.md",".github/workflows/gates.yml","deploy/gravebuster/","deploy/local/","docs/self-hosting.md","src/main.tsx","src/server/db.ts","src/server/index.ts","tests/unit/oauth-and-origin.test.ts"],"completed":["Implemented Google OAuth callback, /api/me endpoint, frontend fragment pickup, public origin resolution, static file serving, and gravebuster Docker Compose stack"],"decisions":["Use deterministic UUID derived from Google sub to satisfy Postgres UUID auth_user_id","Serve Vite dist as static fallback in Node server and via Caddy in gravebuster compose","Support both GOOGLE_OAUTH_CLIENT_ID and GOOGLE_CLIENT_ID seamlessly"],"evidence":["112 Vitest tests pass across 20 files","tsc --noEmit passes","JSON contract integrity passes (18 contracts)","55 python unit tests pass","PCM validate and CGM validate pass"],"next_action":"Create pull request with auto-merge for OCTO-1000","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-10-01T19:40:00Z"} -->

Completed:
- Implemented Google OAuth callback, /api/me endpoint, frontend fragment pickup, public origin resolution, static file serving, and gravebuster Docker Compose stack

Evidence:
- 112 Vitest tests pass across 20 files
- tsc --noEmit passes
- JSON contract integrity passes (18 contracts)
- 55 python unit tests pass
- PCM validate and CGM validate pass

Decisions:
- Use deterministic UUID derived from Google sub to satisfy Postgres UUID auth_user_id
- Serve Vite dist as static fallback in Node server and via Caddy in gravebuster compose
- Support both GOOGLE_OAUTH_CLIENT_ID and GOOGLE_CLIENT_ID seamlessly

Changed:
- AGENTS.md
- .github/workflows/gates.yml
- deploy/gravebuster/
- deploy/local/
- docs/self-hosting.md
- src/main.tsx
- src/server/db.ts
- src/server/index.ts
- tests/unit/oauth-and-origin.test.ts

Blocked/uncertain:
- none

Next:
- Merged PR #47 to main; harden container migration execution, systemd user unit, static serving, and session restoration

### 2026-10-01 20:00:00 UTC — Pukujan

<!-- continuity:checkpoint {"agent":"Pukujan","blocked":[],"changed":["deploy/gravebuster/docker-compose.yml","deploy/gravebuster/initdb/01-apply-migrations.sh","deploy/gravebuster/systemd/octo-autodeploy.service","deploy/local/docker-compose.yml","src/main.tsx","src/server/index.ts","tests/unit/oauth-and-origin.test.ts"],"completed":["Mounted 01-apply-migrations.sh to execute migrations on Postgres container init","Removed invalid User= directive from systemd user service unit","Fixed static asset serving path traversal check and excluded /api/ routes from SPA fallback","Purged stale tokens in frontend on 401 response from /api/me","Added test coverage for forwarded headers and 404 JSON handling"],"decisions":["Explicitly execute /docker-entrypoint-initdb.d/migrations/*.sql via 01-apply-migrations.sh since Postgres does not recurse into subdirectories","Keep user service units without User= directive per systemd standard"],"evidence":["115 Vitest tests pass across 20 files","tsc --noEmit passes","55 python unit tests pass","JSON contract integrity passes (18 contracts)","PCM validate passes"],"next_action":"Create pull request with auto-merge to main for deployment hardening fixes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-10-01T20:00:00Z"} -->

Completed:
- Mounted 01-apply-migrations.sh to execute migrations on Postgres container init
- Removed invalid User= directive from systemd user service unit
- Fixed static asset serving path traversal check and excluded /api/ routes from SPA fallback
- Purged stale tokens in frontend on 401 response from /api/me
- Added test coverage for forwarded headers and 404 JSON handling

Evidence:
- 115 Vitest tests pass across 20 files
- tsc --noEmit passes
- 55 python unit tests pass
- JSON contract integrity passes (18 contracts)
- PCM validate passes

Decisions:
- Explicitly execute /docker-entrypoint-initdb.d/migrations/*.sql via 01-apply-migrations.sh since Postgres does not recurse into subdirectories
- Keep user service units without User= directive per systemd standard

Changed:
- deploy/gravebuster/docker-compose.yml
- deploy/gravebuster/initdb/01-apply-migrations.sh
- deploy/gravebuster/systemd/octo-autodeploy.service
- deploy/local/docker-compose.yml
- src/main.tsx
- src/server/index.ts
- tests/unit/oauth-and-origin.test.ts

Blocked/uncertain:
- none

Next:
- Create pull request with auto-merge to main for deployment hardening fixes

### 2026-11-01 01:46:45 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["none"],"completed":["Since 2026-10-26: #339 analytics specs, #345/#348 MCP tool surface, #354 confirm window, #358 env-to-vault, #381/#383 rerank, #394 VPS compose overlay, #396 RAG access once per search, #397 halfvec 512, #401 Phoenix traces, #404 vault relay fix, #405 Umami per workspace, #407 and #411-#413 agent stack 1.0.1 to 1.0.4, #408 CLAUDE.md loads AGENTS.md, #337 phone dialogs and secret-storage CTA","Promoted main bcd9bfb to production via #406 (production 3d78888)"],"decisions":["Live app runs on the VPS (ssh vps, ~/apps/octo), Komodo stack octo; octo-deploy-on-push deploys when production moves. Hosting is decided in Pukujan-lab/server-management vps/PLAN.md. The MacBook Pro keeps on-demand AI jobs only."],"evidence":["VPS ~/apps/octo at 3d78888; octo-api and octo-web healthy after the deploy; https://octodb.design-bakery.com/health ok","Stack lock .coord/hotload.lock.json at agent-stack-train ad6d9d6 = certified 1.0.4"],"evidence_class":"observed","next_action":"Open feature issues: #400 Umami, #399 RAG graph step, #395 shared embed/rerank endpoints, #393 Retrieval/Deployments views, #391 filtered-search scan, #385 octo-graph volume; #410 rule enforcement for Claude sessions","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-11-01T01:46:45Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"a87f54ac6b856efeeacf06f0e8fa543945fa76e419de002461dc1ca4894579aa","request_id":"d2a094a9197b4fd8a31a841846b194de","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1000"} -->

Completed:
- Since 2026-10-26: #339 analytics specs, #345/#348 MCP tool surface, #354 confirm window, #358 env-to-vault, #381/#383 rerank, #394 VPS compose overlay, #396 RAG access once per search, #397 halfvec 512, #401 Phoenix traces, #404 vault relay fix, #405 Umami per workspace, #407 and #411-#413 agent stack 1.0.1 to 1.0.4, #408 CLAUDE.md loads AGENTS.md, #337 phone dialogs and secret-storage CTA
- Promoted main bcd9bfb to production via #406 (production 3d78888)

Evidence:
- VPS ~/apps/octo at 3d78888; octo-api and octo-web healthy after the deploy; https://octodb.design-bakery.com/health ok
- Stack lock .coord/hotload.lock.json at agent-stack-train ad6d9d6 = certified 1.0.4

Decisions:
- Live app runs on the VPS (ssh vps, ~/apps/octo), Komodo stack octo; octo-deploy-on-push deploys when production moves. Hosting is decided in Pukujan-lab/server-management vps/PLAN.md. The MacBook Pro keeps on-demand AI jobs only.

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open feature issues: #400 Umami, #399 RAG graph step, #395 shared embed/rerank endpoints, #393 Retrieval/Deployments views, #391 filtered-search scan, #385 octo-graph volume; #410 rule enforcement for Claude sessions

### 2026-11-01 02:55:45 UTC — claude-opus-5-5

<!-- continuity:checkpoint {"agent":"claude-opus-5-5","blocked":[],"changed":["none"],"completed":["#419 verification: #420 PROJECT/ARCHITECTURE rewrite, #421 generated isolation tests over every route and MCP tool (also fixed the shadowed schedule DELETE route), #423 RAG/rerank/graph metamorphic tests, #424 TLA+ models checked by TLC in gates, #425 PDD section 8 as the contract"],"decisions":["TLA+ findings are pinned as expected failures, not fixed: unhashed restore can overwrite good R2 bytes; archive can prune bytes an on-demand recall just restored; a lost provisioning race orphans a database; in-flight requests finish after key revoke"],"evidence":["PRs 420, 421, 423, 424 and 425 merged with gates green; gates run 41266674154 shows all ten TLC configs at their expected exit"],"evidence_class":"observed","next_action":"Owner to choose which TLA+ findings to fix (restore without archive_hash is the one that can lose bytes); open feature issues #400 #399 #395 #393 #391 #385 #410","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-11-01T02:55:45Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"364ab783c2200d3c32526f305c0b764c010415c7bc8cbcb4afb8a1c6f9e16d63","request_id":"34a1e3d5a45d41f8866f9366729bc303","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1000"} -->

Completed:
- #419 verification: #420 PROJECT/ARCHITECTURE rewrite, #421 generated isolation tests over every route and MCP tool (also fixed the shadowed schedule DELETE route), #423 RAG/rerank/graph metamorphic tests, #424 TLA+ models checked by TLC in gates, #425 PDD section 8 as the contract

Evidence:
- PRs 420, 421, 423, 424 and 425 merged with gates green; gates run 41266674154 shows all ten TLC configs at their expected exit

Decisions:
- TLA+ findings are pinned as expected failures, not fixed: unhashed restore can overwrite good R2 bytes; archive can prune bytes an on-demand recall just restored; a lost provisioning race orphans a database; in-flight requests finish after key revoke

Changed:
- none

Blocked/uncertain:
- none

Next:
- Owner to choose which TLA+ findings to fix (restore without archive_hash is the one that can lose bytes); open feature issues #400 #399 #395 #393 #391 #385 #410

### 2026-11-01 09:19:33 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["Removed Octo's own Sablier; octo-web joins the host's shared sablier network; session_duration 10m (#453)"],"decisions":["Owner: server-management owns Sablier on the VPS (Pukujan-lab/server-management#85)"],"evidence":["compose config and caddy validate on the VPS; shared Sablier live and answering octo-web at 09:14 UTC"],"next_action":"Merge #454, then promote main to production","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1000","timestamp":"2026-11-01T09:19:33Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"37cd4b6dc7ecd73260628e56bb6cd05886d8ca9128188bae2d01f45586f9ed04","request_id":"d48784bb2b864f7b972b68fc2439962a","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1000"} -->

Completed:
- Removed Octo's own Sablier; octo-web joins the host's shared sablier network; session_duration 10m (#453)

Evidence:
- compose config and caddy validate on the VPS; shared Sablier live and answering octo-web at 09:14 UTC

Decisions:
- Owner: server-management owns Sablier on the VPS (Pukujan-lab/server-management#85)

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge #454, then promote main to production
