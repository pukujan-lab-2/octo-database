# TASK-OCTO-1003 — Rag Graph Step

<!-- continuity:task {"acceptance":["replace this with observable, task-specific acceptance checks"],"depends_on":[],"goal":"Let a search follow links between documents: a document link table, a graph option on the RAG query and the MCP, and link tools","id":"OCTO-1003","issue_url":"https://github.com/pukujan-lab-2/octo-database/issues/42","next_action":"define scope and observable acceptance checks, then begin bounded work","owner":"Pukujan","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A case the matching cases cite shares no words or meaning with the question, and only Precedent's legal engine could find it"} -->

- Status: active
- Owner: Pukujan
- Priority: P2
- Depends on: none

## Goal

Let a search follow links between documents: a document link table, a graph option on the RAG query and the MCP, and link tools

## Why

A case the matching cases cite shares no words or meaning with the question, and only Precedent's legal engine could find it

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

### 2026-11-08 02:28:38 UTC — agent:claude-code/435d6f7b-eb71-4bee-b7fe-c4020dabba12

<!-- continuity:checkpoint {"agent":"agent:claude-code/435d6f7b-eb71-4bee-b7fe-c4020dabba12","blocked":[],"changed":["db/migrations/20261108000000_rag_document_links.sql, src/rag/graph.ts, src/routes/rag.ts, src/server/db.ts, src/api/capabilities.ts, src/mcp/*, tests"],"completed":["Document links table, graph option on the RAG query and query_workspace, link routes and MCP tools, tests"],"decisions":["no new decisions"],"evidence":["Local Playwright, vitest, Python schema tests, typecheck and import lint passed; PR 88 open with auto-merge armed"],"next_action":"When PR 88 merges and reaches production, load the housing QA set's citations as links and compare results with the legal engine","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"OCTO-1003","timestamp":"2026-11-08T02:28:38Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"79526eb303fa36d5adb628de9253e78225b9b2208d57454f6dc9f95b3253c664","request_id":"0d3d794c0e6443a7a698f46cfd852386","schema":"project-continuity.checkpoint-operation.v1","task_id":"OCTO-1003"} -->

Completed:
- Document links table, graph option on the RAG query and query_workspace, link routes and MCP tools, tests

Evidence:
- Local Playwright, vitest, Python schema tests, typecheck and import lint passed; PR 88 open with auto-merge armed

Decisions:
- no new decisions

Changed:
- db/migrations/20261108000000_rag_document_links.sql, src/rag/graph.ts, src/routes/rag.ts, src/server/db.ts, src/api/capabilities.ts, src/mcp/*, tests

Blocked/uncertain:
- none

Next:
- When PR 88 merges and reaches production, load the housing QA set's citations as links and compare results with the legal engine

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
