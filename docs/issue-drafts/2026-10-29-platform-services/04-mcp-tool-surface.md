# [ISSUE]: The MCP adapter's flat tool list will outgrow agent context and tool choice as services are added

> **DRAFT — not filed.** Child of `00-umbrella.md`. Overlaps #300 (open; already holds a live measurement of 5,712 tokens and says "re-measure if the catalog roughly doubles"). This draft supplies the trigger for that re-measure (children 02 and 03 would roughly double it) and a concrete ordered proposal. The owner may prefer posting it as a comment on #300.

## Summary

Octo's MCP adapter (MCP = Model Context Protocol, how agents call Octo's tools) registers every tool in one flat list for every caller. Today that is 29 tools. If traces, evals, deploy and vault verbs are added the list could pass 60–80. The larger risk is not tokens but **wrong tool choice among similar names** (`query_workspace`, `query_dataset`, `query_graph`, `query_workspace_database`, `query_claims_as_of`).

**Proposal** *(proposal — none of this exists yet)*, in order of expected impact:

1. **Filter the list by the calling key's scopes and the workspace's enabled services**, reusing `GET /api/capabilities`.
2. **A small always-on core plus `enable_service(...)`**, announced with the MCP `tools/list_changed` notification.
3. **Lazy docs**: a `guide(topic)` tool and very short connect-time instructions.
4. **Service-prefixed tool names** (e.g. `analytics_query`, `graph_query`).
5. **Compact JSON output** (drop pretty-printing).
6. If a generic describe/call pattern is used for the long tail, **keep destructive or outward-facing actions as named tools** (delete, deploy, mint keys) so client approval prompts stay meaningful.
7. **Wrapped services get about 3–5 verbs each**, not mirrored APIs.

## Identity and Lineage

- Leaf issue: this draft (unfiled). Parent: `00-umbrella.md`. Branch: none.

## Symptoms

1. **29 tools in one flat list.** `src/mcp/server.ts` has 29 `server.tool(` registrations: whoami, list_workspaces, create_workspace, mint_key, provision_database, query_workspace_database, list_files, upload_file, download_file, delete_file, query_workspace, ingest_document, list_documents, get_document, rename_document, delete_document, query_graph, project_graph, graph_health, record_epistemic, query_claims_as_of, query_belief_as_of, list_ops_events, get_ops_summary, retry_job, register_dataset, query_dataset, get_analytics_query_status, get_analytics_result. *(verified)*
2. **Measured size.** Connecting an in-memory MCP client to `createOctoMcpServer` and calling `tools/list` (this session, 2026-10-29, `main` @ `d68d959`) returned 29 tools; the JSON was 21,578 bytes (descriptions alone 6,439 bytes) plus 1,031 bytes of connect-time instructions. At roughly 4 characters per token that is about 5.6k tokens; #300 independently measured 22,642 bytes ≈ 5,712 tokens on the live instance. *(measured; token count is an estimate, not a tokenizer run)* The source file is 25,472 bytes.
3. **Every caller sees every tool.** The server registers tools once with no per-key filtering (`src/mcp/server.ts`, top-level `server.tool` calls; no use of scopes). Meanwhile `/api/capabilities` already computes what a key's scopes allow (`capabilitiesForScopes`, `src/api/capabilities.ts:349`, served by `src/routes/capabilities.ts`). *(verified)*
4. **Output is pretty-printed.** `asText` uses `JSON.stringify(value, null, 2)` (`src/mcp/server.ts:16-18`). On a small nested sample the pretty form was 219 characters against 80 compact (2.7×); real results are mostly arrays of objects, so the saving is likely large but was **not measured on real tool output**. *(measured on a sample only)*
5. **Similar names.** Five tools start with `query_`/`query` and cover different backends (documents, graph, workspace SQL, datasets, ledger claims). *(verified by name; no wrong-choice incident observed)*
6. **The SDK supports the pieces needed.** `@modelcontextprotocol/sdk` 1.32.2 exposes `sendToolListChanged()` on the server and `enable()` / `disable()` on registered tools. *(verified in the type declarations; behaviour against real clients not tested)*

## Hypotheses (unverified)

- **H1** *(hypothesis)*: wrong-tool choice, not token cost, is the first real failure as the list grows.
  - Status: open; #300 found no failure at 29.
  - Would confirm: an agent eval (same task set at 29, then ~60 tools) shows more wrong calls or more retries.
  - Would refute: error rate is flat from 29 to 60+.
  - Experiment: run a fixed task set against the current list and against a padded list of plausible future tools; count wrong first calls.
- **H2** *(hypothesis)*: common MCP clients honour `tools/list_changed`, so `enable_service` works without reconnecting.
  - Status: open.
  - Would confirm: ChatGPT's connector, Claude Desktop/Code and one other host refresh their tool list after the notification.
  - Would refute: a host caches the list for the session (#302 recorded ChatGPT showing 25 of 29 tools from a connect-time snapshot, which points this way).
  - Experiment: add one tool at runtime on a test server and watch each host.
- **H3** *(hypothesis)*: filtering by scopes alone removes most tools for narrow keys (read-only, analytics-only) and little for broad ones, so it helps typed keys (#127) but not the owner's own agent.
  - Status: open.
  - Would confirm: count visible tools per key type after filtering.
  - Would refute: even narrow keys keep most of the list.
  - Experiment: apply `capabilitiesForScopes` to each key type's scopes and count the tools it maps to.

## Counter-signal

~5.7k tokens is modest against current context windows, and #300 found no demonstrated selection failure. Client behaviour matters: some hosts load tools lazily on their own, which would shrink the problem without any Octo change. A generic describe/call dispatcher would cut tokens most but weakens typed schemas and client approval prompts (point 6 above; #300 records the same risk).

## Honest Caveat

Token figures are character-count estimates and #300's live figure. The 60–80 tool projection is a guess from adding children 02 and 03 and vault verbs; no list of those tools exists. Wrong-choice risk is plausible, never observed. Whether the adapter should filter by scopes at all conflicts with its header comment, "The adapter adds no policy of its own"; filtering for discovery (not enforcement) may be consistent, since the server still decides, but that is the owner's call.

## Problems vs Gaps

- Problem (evidenced): every caller receives all 29 tool definitions (about 5.6k tokens) and pretty-printed output.
- Gap (untested): wrong-tool choice at 60+ tools (H1); client support for `list_changed` (H2).

## Acceptance Criteria

- [ ] A key with narrow scopes sees only the tools it can use (proposed).
- [ ] Connect-time instructions and tool list together stay under a stated budget, e.g. 3k tokens, for the core set (proposed threshold, untested).
- [ ] Tool results are compact JSON (proposed).
- [ ] Delete, deploy and mint-key actions remain individually named tools (proposed).

## Boundaries and Next Action

- Out of scope: replacing the HTTP capability API; a catch-all dispatcher for everything; duplicating server policy in the adapter.
- Next action: ship the cheapest, no-risk item first (compact JSON, proposal item 5), then run the H2 experiment before building `enable_service`.

## Issue Type

observational

## Lifecycle Status

open

## Filer Origin (who initiated this filing)

human-via-agent (claimed; see umbrella)

## Filing Authorization Evidence

claimed

## Session, Authorization Evidence, and Instruction Reference

- Session reference: Claude Code side session of `local_01150002-bc7f-4d09-aa88-d9c6d3a01dd5`, 2026-10-29.
- Claimed instruction/source: owner asked how to keep the growing MCP adapter manageable and for it to be drafted as part of the Octo issue log.
- Authorization evidence: claimed; drafting only.

## Content Author Account or Runtime Identity

agent:claude-code/side-session-of-local_01150002-bc7f-4d09-aa88-d9c6d3a01dd5

## Directing Human GitHub Account ID

137629468 (claimed)

## Destination Repository

Pukujan/octo-database

## Ontology Versions Used

oio=1.1.0; project=1.0.0

## Project Priority Path

2.3 (MCP / SDK surface gap) is the closest defined concept, but nothing is broken; `5` matches #300. Owner's call.

## Project Priority Concept ID

pukujan-octo-database:priority-5

## Affected App, Adopter, Users, or Systems

Octo's MCP adapter and every agent connected through it (ChatGPT, Claude, others).

## Observed Consequence and Workaround

Observed: 29 tools, about 5.6k tokens of definitions and pretty-printed results for every caller. No selection failure observed.
Workaround: clients can restrict which tools they advertise; callers can use the HTTP API or SDK directly for heavy work.

## Evidence Confidence

supported

## Impact if Unresolved

informational

## Likelihood

plausible

## Exposure

unknown

## Exposure Duration

Not applicable; size measured 2026-10-29 and 2026-10-26 (#300).

## Recoverability

documented-recovery

## Recovery Evidence

Client-side tool filtering; direct API use.

## Risk if the Observation Remains Unresolved

As tools double, agents spend more context on definitions and may pick the wrong similar-named tool. No current failure.

## Risk Introduced by a Proposed Change

Moderate. Renaming tools breaks existing agent prompts and saved configs. Dynamic tool lists may not be honoured by some clients (H2), leaving an agent unable to see a tool it enabled. Scope-based filtering could be read as authorization when the server is still the authority. A generic dispatcher hides approval-worthy actions.

## Product or Release Relevance

supports

## Named Product Outcome and Cost of Delay

`PROJECT.md`: a fresh agent discovers only allowed capabilities and uses them reliably through a thin adapter (as quoted in #300).

## Cost of Delay

Low now; rises when children 02 and 03 add tools.

## Smallest Useful Product Slice

Compact JSON output, plus filtering the list by the key's scopes via the existing capabilities mapping.

## Provenance and Context

- Destination: Pukujan/octo-database; `main` @ `d68d95953f8acfd9f411dfa2980bf7f116d38add`, 2026-10-29
- Measurement: in-memory MCP client against `createOctoMcpServer` with a stub API (no live instance); script kept in this session's scratchpad, not in the repo
- Ontology versions: OIO 1.1.0 / project 1.0.0

## Reproducibility Steps and Evidence

1. `grep -c "server.tool(" src/mcp/server.ts` → 29.
2. Connect an in-memory MCP client (SDK `InMemoryTransport.createLinkedPair`) to `createOctoMcpServer({})`; call `listTools()`; sum `JSON.stringify(tools).length` → 21,578 bytes; `getInstructions().length` → 1,031.
3. `sed -n 16,18p src/mcp/server.ts` → `JSON.stringify(value, null, 2)`.

## Issue Relations

related: #300
related: #302
related: #127

## Citations and References

- `src/mcp/server.ts`, `src/api/capabilities.ts`, `src/routes/capabilities.ts`
- #300 (catalog growth, live measurement), #302 (25-vs-29 connect snapshot), #127 (typed keys)

## Non-Binding Proposed Next Actions

*(proposal)*

- Compact JSON now; measure real result sizes.
- Run H1 and H2 before building `enable_service` or renaming tools.
- Fix the rule that any new service gets 3–5 verbs before children 02 and 03 add tools.
