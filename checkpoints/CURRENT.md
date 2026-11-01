# Current repository checkpoint

<!-- continuity:current {"active_task":null,"active_task_file":null,"protocol_version":"0.1.0-draft","schema":"project-continuity.current.v1"} -->

Older state: [`history/2026-10.md`](history/2026-10.md) and earlier months in `history/`.

## Current state (2026-10-31)

- `production` = `3d78888` (#406), live on the VPS (`ssh vps`, `~/apps/octo`, Komodo stack `octo`; `octo-deploy-on-push` deploys when `production` moves). Hosting is decided in `Pukujan-lab/server-management` `vps/PLAN.md`. The MacBook Pro keeps on-demand AI jobs only.
- Agent stack 1.0.4 @ `ad6d9d6` (certified train).

## Next action

- Open feature issues: #400 Umami, #399 RAG graph step, #395 shared embed/rerank endpoints, #393 Retrieval/Deployments views, #391 filtered-search scan, #385 octo-graph volume; #410 rule enforcement for Claude sessions.
- design-bakery residual: `agent_tokens` and `publish_kit_hero_cache` start empty (never exposed by Supabase); re-seed agent tokens if agent publishing is needed. Orphaned R2 objects under `workspaces/e2f12428…/` and the `octo-public` mirror can go when the owner wants the bucket cleaned.
