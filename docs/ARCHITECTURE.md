# How Octo works

Say an agent working on another project needs to store files, search documents and run SQL. It holds one Octo key. It calls `POST /api/rag/query` or the MCP tool `query_workspace`. Octo checks who the key belongs to, which workspace it may touch and what it may do there. Then it runs the search inside that workspace's data and nowhere else. This document follows that request through the system, piece by piece, with the file that implements each step.

`PROJECT.md` says what Octo provides and why. This file says how it works and where new code goes. `AGENTS.md` carries the short version of the code-layout rules. Line numbers drift, so the references name files and functions.

## The running system

| Container | What it does |
|---|---|
| `octo-web` | Caddy serving the built Vite single-page app (`frontend/`) |
| `octo-api` | Node running `src/server/index.ts`: the HTTP API, the MCP endpoint, the job queue and schedulers |
| `octo-db` | Postgres 16 with pgvector. Holds the control database and every workspace database |
| `octo-graph` | FalkorDB, one graph per workspace, on the `octo-graph-data` volume |
| `octo-embed` | The embedding model (an OpenAI-compatible `/embeddings` endpoint) |
| `octo-phoenix` | Phoenix, the trace viewer |
| `octo-cloudflared` | The Cloudflare tunnel that serves `octodb.design-bakery.com` |

The compose file is `deploy/gravebuster/docker-compose.yml`; the VPS adds `docker-compose.vps.yml`. A push to the `production` branch makes Komodo redeploy (`octo-deploy-on-push`). Umami, the PDF reader and the reranker run outside this compose file; Octo reaches them by URL (`OCTO_UMAMI_URL`, `OCTO_READER_URL`, `OCTO_RERANK_URL`).

## Who can call Octo

**Every request carries `Authorization: Bearer <token>`.** There is no session cookie. `authenticateRequest` in `src/server/auth-context.ts` tells the token types apart by prefix:

| Token | Who holds it | Lifetime |
|---|---|---|
| `octo_sess_…` | A person in the browser, after Google or guest sign-in | 20 minutes, signed with `OCTO_SESSION_SECRET`, no server state |
| `octo_live_acc_…` / `octo_live_ws_…` | An app or agent: an API key, account-wide or pinned to one workspace | Until revoked, or `expiresInDays` |
| `eyJ…` | An MCP client after OAuth 2.1 (PKCE, dynamic registration) | 1 hour access, 30 day refresh; bound to one workspace |

Each route calls `authenticateRequest` itself; there is no global middleware. Some routes accept other credentials: signed media URLs for file bytes, share tokens for public shares, and vault grant and lease tokens (below).

**People.** Google sign-in (`src/routes/auth.ts`) creates a principal from the Google account and a "Personal" workspace on first login. Guest sign-in (`POST /api/auth/guest`, Turnstile-checked when `TURNSTILE_SECRET_KEY` is set) creates a throwaway principal and a "Personal (Guest)" sandbox workspace.

**Agents are not separate accounts.** An agent acts with a credential that belongs to a person: an API key, an OAuth token, or a vault lease. `octo.principals` has only `is_platform_owner` and `is_guest` flags.

**Keys and scopes.** Keys live in `octo.api_keys` as unsalted SHA-256 hashes (`src/lib/secret-hash.ts`). There are four scopes (`src/api/capabilities.ts`):

- `read`: metadata, listings, read-only SQL
- `write`: uploads, publishing, jobs, creating workspaces, writable SQL
- `files`: file and media bytes
- `delete`: deleting files and revoking keys

A person's own session is never limited by scopes. A workspace key works only on its workspace (`keyWorkspaceMatches`), and its effective role is the lower of the key's role and the person's live membership role. A key that mints a key can only narrow its own authority (`src/api/keys.ts`). Each use of a key is logged in `octo.agent_key_uses`. A revoked or expired key, or a known key from a new address, triggers a phone alert (`src/server/auth-context.ts`).

**Owner agent keys.** Account-wide keys listed in `OCTO_OWNER_AGENT_KEYS` act as the owner's own session. They skip scope checks and the confirm gate, and they can read vault secrets. They exist so the owner's agents can work without a person present.

**Roles** in a workspace, from most to least: `owner`, `admin`, `operator`, `member` (`src/types/auth.ts`). `member` reads. `operator` uploads, publishes, ingests and runs jobs. `admin` deletes, manages shares and enables UX analytics. Only `owner` deletes the workspace. The platform owner passes every membership check. Memberships are only ever created as `owner` today; there is no invite route.

**The confirm gate** (`src/server/confirm.ts`) stands in front of risky changes: creating or deleting a workspace, minting or re-scoping a key, and every vault change. The person asks for a 6-character code (`POST /api/me/confirm-challenge`, valid 10 minutes, single use), plus a TOTP code if they enrolled MFA. After a full pass, further changes within **two minutes** need no code. API keys can never confirm; owner agent keys always pass. Codes and the two-minute window live in process memory.

## How workspaces are kept apart

Octo uses three layers, from the outside in.

**1. The route checks.** Every workspace route runs the same sequence: authenticate (401), scope (403), key pinned to this workspace (403 "Key restricted to different workspace"), membership (403 "Not a member"), role. Example: `src/routes/rag.ts`.

**2. Row-level security in the control database.** All `octo.*` tables live in one database, `postgres`. The API connects through two pools in `src/server/db.ts`:

- `dbPool` (`OCTO_DB_URL`, role `octo_app`, no BYPASSRLS) for request work. Each query runs in a transaction that first sets `octo.principal_id` and `request.workspace_id` from the request's identity, held in one `AsyncLocalStorage`.
- `servicePool` (`OCTO_SERVICE_URL`, role `octo_service`, BYPASSRLS) for trusted background work such as publishing, archive state and the retention sweep.

Policies use helpers such as `octo.is_workspace_member()` and `octo.current_workspace_id()`. A RESTRICTIVE `tenant_scope_fence` policy on the tenant tables makes sure a workspace-pinned key never sees another workspace's rows, even where another policy would allow it (migration `20261001080000_slice14_key_scope_isolation.sql` and later ones). Tables that only the server should touch (stored database passwords, OAuth state, key-use logs) have RLS on and no policy at all, so only `octo_service` reaches them.

**3. A database per workspace.** `src/server/provisioning.ts` creates `octo_ws_<slug>_<random>` with its own login role `<db>_rw` (`NOSUPERUSER NOCREATEDB NOCREATEROLE`), revokes `CONNECT` from everyone else, and enables `vector`. This runs on a separate admin connection (`OCTO_ADMIN_URL`). The catalog row goes into `octo.workspace_databases`, and the role's password is stored encrypted. A workspace gets its database automatically when it is created through the API (`src/server/auto-provision.ts`, best effort); sign-in sandboxes do not.

**The SQL surface** (`POST /api/workspaces/:id/query`, `src/server/query.ts`) connects as that workspace's `_rw` role, never as an admin. Without the `write` scope the statement runs in `BEGIN READ ONLY`. Results cap at 1,000 rows by default and 10,000 at most; statements time out after 30 seconds.

**Files are separated by key prefix, not by bucket.** Every object key starts with `workspaces/<workspaceId>/`. There is one private bucket, one public bucket for published files, and one optional Drive folder.

## Data

### Files

Upload (`src/routes/files.ts`) writes the bytes to R2 first, then the catalog row, and deletes the object if the row fails. Publishing copies the object to the public bucket and returns `<public base>/<fileId>` (`src/storage/publish-service.ts`). Archiving moves cold files to Google Drive: copy, verify by SHA-256, record the state, then delete the R2 copy. Restoring copies back and keeps the Drive copy (`src/storage/archive-service.ts`). Archive and restore run as queued jobs (`src/jobs/worker.ts`); the queue drains every minute and the retention sweep runs hourly (`src/server/queue.ts`). File states: `active_r2`, `archiving`, `archived_drive`, `restoring`, `reconciliation_required`.

### Document search (RAG)

**Ingest** (`src/rag/ingest.ts`): text is chunked by paragraph (800 characters, 100 overlap). PDFs are read page by page by a PaddleOCR-VL reader (`OCTO_READER_URL`), falling back to the PDF's text layer, and passages whose numbers are not on the page are dropped. Uploading an indexable file queues an ingest job automatically.

**Embeddings** (`src/rag/embeddings.ts`) come from any OpenAI-compatible endpoint (`OCTO_EMBEDDING_*`; default model `qwen3-embedding:0.6b`). Vectors are cut to 512 dimensions, normalized, and stored as `halfvec(512)` with an HNSW cosine index.

**Search** is one SQL function, `octo.match_chunks_hybrid`. It runs a vector search and a full-text search (`ts_rank`, not true BM25), each taking 4× the limit, and fuses them with reciprocal rank fusion (k=60). Filters (`documentIds`, `titlePrefix`, `latestVersionOnly`) apply inside the search, before the limit. The function checks workspace access once per search instead of per row. It is `SECURITY DEFINER`, which took a 133k-row search from about 80 s to about 1 s (#396).

**Reranking** (`src/rag/rerank.ts`) is on by default when `OCTO_RERANK_URL` is set. It may list several URLs, tried in order. It reranks `min(max(limit×2, 20), 50)` candidates. If no reranker answers, the fused order stands. `rerank: false` skips it.

### Knowledge ledger and graph

Claims, evidence, beliefs and their links are recorded in Postgres with valid time, and you can ask what was believed as of a date (`query_claims_as_of`, `query_belief_as_of`). **Postgres is canonical; the graph is a rebuildable copy.** The projector (`src/graph/projector.ts`) deletes a workspace's graph `octo_ws_<uuid>` in FalkorDB and rebuilds it from the ledger rows, so the same rows always give the same graph. Projection runs on request (`POST /api/graph/project`) or as a `graph_rebuild` job, not automatically on writes. `/api/graph/health` reports how stale the graph is. Reads go through Octo with `GRAPH.RO_QUERY` (`src/routes/graph.ts`); the graph name comes from the authenticated workspace, never from the caller.

### Analytics

A workspace registers Parquet datasets stored at `workspaces/<ws>/lake/<slug>/v<n>/…` in R2 (`src/analytics/`). Queries are saved specs: one `SELECT` with typed parameters, validated against the dataset's schema. Each run starts a fresh in-process DuckDB that mounts the Parquet parts as a view. `append: true` adds a partition to the newest version. A schedule (checked every 60 s) runs a spec when a new dataset version lands and writes the result into `analytics.<table>` in the workspace's own database, as that workspace's role (`src/analytics/sink.ts`).

### Agent traces

`POST /api/workspaces/:id/otel/v1/traces` takes OpenTelemetry spans with a `write` key and forwards them unchanged to Phoenix under a project named after the workspace slug (`src/routes/traces.ts`). `GET …/otel/link` opens that project.

### UX analytics

`POST /api/workspaces/:id/ux-analytics` (owner or admin) creates an Umami team and website for the workspace, with replay masking on, and makes each member a Umami user. Owner and admin become team managers, operator a team member, member view-only (`src/lib/umami.ts`). People open Umami through its SSO link.

### Vault

The vault (`src/routes/vault.ts`) stores logins, tokens, URLs and notes, encrypted with AES-256-GCM (key derived from `OCTO_MFA_SECRET`). Only a person's session or an owner agent key can read a secret in plain text; ordinary API keys are refused. Other agents get:

- a **grant** (`octo_vault_…`, 1–72 h), which shows the inventory but no secrets;
- a **lease** (`octo_tmp_…`, up to 30 days, one item), which they use through the **relay**.

The relay (`/api/vault/relay/<route>`, `src/routes/vault-relay.ts`) swaps the lease for the real secret and forwards the request upstream. It follows only same-origin redirects. It scrubs the secret (raw, URL-encoded and Basic-auth forms) from every response header and body, so an echoing upstream cannot leak it back (#404).

## MCP

`src/mcp/server.ts` builds one MCP server with 35 tools: workspaces, keys, workspace SQL, files, documents and search, the ledger and graph, ops, and analytics. It runs two ways: Streamable HTTP at `/mcp` (stateless, a fresh server per request) and stdio (`npm run mcp`).

**The MCP adapter adds no policy of its own.** Each tool calls the HTTP API over loopback with the caller's own token (`src/mcp/client.ts`), so a tool is refused exactly when the matching route would be.

**Keeping the tool list small.** At connect time the server asks `GET /api/capabilities` what the token may do and hides every tool it cannot use (`restrictToCapabilities`, #345). A read-only key never sees `delete_file`. Results are compact JSON. Instead of long tool descriptions, `guide(topic)` returns usage notes on demand (`workspaces`, `ledger`, `analytics`, `keys`). Four tools are always listed: `guide`, `whoami`, `mint_key` and `query_workspace`. Traces and UX analytics have no MCP tools; agents send spans over OTLP.

## Code layout

Octo is a **modular monolith organized by feature**. One deployable API, one obvious place for each kind of thing.

```
src/
  routes/       one file per HTTP route family, listed in the ROUTES array in src/server/index.ts
  server/       composition root, request plumbing, the database module
    index.ts      builds the runtime and owns the dispatch loop (first handler to claim a request wins)
    db.ts         both pools, the request-identity AsyncLocalStorage, and every SQL store, in one file today
    auth-context.ts, confirm.ts, http.ts, oauth.ts, mcp-http.ts, provisioning.ts, query.ts, queue.ts, ...
  api/ auth/ media/ storage/ jobs/ rag/ graph/ analytics/ mcp/ sync/ backup/ triage/ qa/
                domain services, one folder per slice
  lib/          pure helpers with no I/O to Octo state (leaf)
  types/        shared types (leaf)
frontend/       its own Vite + React tree with its own eslint config
db/migrations/  SQL migrations, applied in filename order
```

`src/server/db.ts` is still a single file of about 4,000 lines. The planned split into `db-core.ts` (pools and request identity) and `db/<domain>.ts` stores has not landed. `.dependency-cruiser.cjs` already names those paths so the rules hold once it does.

### The layer rule

```
routes ──▶ services ──▶ src/server/db (barrel) ──▶ lib ──▶ types
```

One direction only; a lower layer never imports a higher one.

- **routes**: match a request, authenticate, call a service or the db module, shape the response. No SQL.
- **services** (`src/<domain>/`): business logic for a slice. Never import `src/routes/`.
- **db module** (`src/server/db.ts`): SQL, the pools and the request identity. The only module that may import `pg` or create an `AsyncLocalStorage`.
- **lib**, **types**: leaves.

`npm run lint:imports` (dependency-cruiser) runs inside the required `gates` check and fails CI on a wrong-way import. **Fix a violation by moving the code, not by widening a rule.** A carve-out needs owner approval and a `comment` naming its removal condition.

| You are adding | Put it in |
|---|---|
| An HTTP endpoint | `src/routes/<family>.ts`, plus one line in `ROUTES` if the family is new, plus a row in `tests/e2e/route-table.ts` (a unit test fails without it; the row gets the endpoint its isolation tests) |
| Business logic | `src/<domain>/<name>-service.ts` |
| SQL | `src/server/db.ts` (a `db/<domain>.ts` store once the split lands), imported through `src/server/db` |
| A request/response helper | `src/server/http.ts` |
| Auth or scope plumbing | `src/server/auth-context.ts` |
| A pure helper | `src/lib/` |
| A React component or page | `frontend/src/components/…`, `frontend/src/pages/` or `frontend/src/views/` |
| An MCP tool | `src/mcp/server.ts`, calling an existing HTTP route, plus its entry in `TOOL_ACTIONS` |

### Two load-bearing invariants

These break silently; the tests can stay green.

**1. Import order in `src/server/index.ts`.** The `.env` load and the `./runtime` import come after the `./db` imports, because `db.ts` and `provisioning.ts` read the environment at module load. Do not reorder them.

**2. Routes import database functions from `src/server/db`.** `tests/unit/ops-events-500-capture.test.ts` mocks that module by id. A route that reached around it would bypass the mock and the test would pass while testing nothing. The `barrel-is-the-db-surface` rule enforces this.

### Deliberate omissions

No web framework, no DI container, no ORM, no event bus. The raw-`http` ordered dispatch loop is the intended shape. Do not add machinery to "improve" it unless the owner asks.

## Known gaps

These are true of `main` today. Each is a fact to plan around, not a decision.

- **The nightly backup misses workspace databases.** `deploy/mac/backup.sh` runs `pg_dump -d postgres`, so only the control database is saved (#202).
- **Row-level security depends on configuration.** If `OCTO_DB_URL` and `OCTO_SERVICE_URL` are unset, both pools fall back to `DATABASE_URL`, a superuser, and RLS filters nothing (#111). Production sets both.
- **`octo.graph_projections` has no tenant fence**, unlike the other tenant tables.
- **Two concurrent database provisions for one workspace** can both pass the "already provisioned" check; the loser would leave an orphaned database and role.
- **Deleting a workspace leaves its files** in R2 and Drive and reports them as `orphanedObjects`. Deleting an archived file does not delete its Drive copy.
- **Confirm codes and the two-minute window are in memory**, lost on restart and not shared between processes. Revoking a key needs the `delete` scope but no confirmation.
- **Google sign-in sends no OAuth `state` parameter**, and reads the `id_token` without checking its signature (it comes straight from Google's token endpoint).
- **`files.content_hash` is not a hash**; it holds `stored-<bytes>`. The real SHA-256 is `archive_hash`.
- The root `.env.example` still says `OCTO_EMBEDDING_DIMENSIONS=1024`; the code and the deploy example use 512.
