# Self-hosting and multi-tenant provisioning of OSS UX analytics tools (as of 2026-10-31)

Scope: PostHog hobby, OpenReplay CE, Countly Lite, Matomo (+ Heatmap & Session Recording plugin), Rybbit, OpenPanel, Umami, DIY (rrweb + ClickHouse/Postgres). Target box: Xeon E-2136 6c/12t, 32 GB RAM (~22 GB free), 380 GB disk, Ubuntu 26.04, Docker/Komodo, existing Postgres 17, >1M events/month across several small apps.

Method note: compose files, licences and source code were pulled directly from each repo's default branch on 2026-10-31 (raw.githubusercontent.com / GitHub API). Release dates are from the GitHub releases API on the same day. Vendor marketing and third-party template pages are flagged as such.

## 1. Footprint: RAM/CPU/disk, measured and documented

### Takeaway
Measured numbers at 1-5M events/month are scarce for every tool; most figures are vendor minimums or template idle readings. The tiers are clear, though. Umami (app + Postgres) is lightest. Rybbit and OpenPanel (ClickHouse + Postgres + Redis, plus Redpanda for OpenPanel) idle around 1 GB and fit easily. OpenReplay wants 8 GB. PostHog hobby is a ~40-service stack whose own installer says "You REALLY need 8GB or more" and whose docs say 16 GB. It would fit in 22 GB, but it is officially "unlikely to scale past a couple 100ks events".

### Cited Findings
**PostHog hobby**
- The docs size a "Hetzner VM with 4 vCPU, 16GB RAM, and more than 30GB storage". They suggest self-hosting may not suit you above 300k events, 1k recordings or 300k /flags calls, and recommend Cloud at about 1M events/month — [PostHog self-host docs](https://posthog.com/docs/self-host)
- The disclaimer says: "Everything runs on a single machine, and thus is unlikely to scale past a couple 100ks events without significant effort in scaling" — [PostHog OSS disclaimer](https://posthog.com/docs/self-host/open-source/disclaimer.md)
- The README still says "recommended 4GB memory". This conflicts with the docs (16 GB) and with the installer script (8 GB+) — [PostHog README](https://github.com/posthog/posthog)
- The `bin/deploy-hobby` script prints "⚠️ You REALLY need 8GB or more of memory to run this stack ⚠️". On a failed start it suggests checking "Insufficient memory" — [deploy-hobby](https://raw.githubusercontent.com/PostHog/posthog/master/bin/deploy-hobby)
- `docker-compose.hobby.yml` on master (fetched 2026-10-31) defines roughly 40 services: db (postgres:15.12-alpine), redis7, valkey, clickhouse, zookeeper, kafka (Redpanda v25.1.9), worker, web, plugins, ingestion-general/sessionreplay/error-tracking/logs/traces, recording-api, objectstorage + seaweedfs, browserless chromium, temporal + elasticsearch + temporal-ui + temporal-django-worker, capture, capture-ai, capture-logs, replay-capture, property-defs-rs, livestream, personhog-replica/router, feature-flags, hypercache-server, cymbal, and others — [docker-compose.hobby.yml](https://raw.githubusercontent.com/PostHog/posthog/master/docker-compose.hobby.yml); [docker-compose.base.yml](https://github.com/PostHog/posthog/blob/master/docker-compose.base.yml) (ClickHouse image `clickhouse-posthog:26.9.5.2`)
- An early experiment on a $5 droplet found Kafka crashing with a Java OOM. It estimated Kafka alone needs ~1 GB. This is about 5 years old and predates the switch to Redpanda — [PostHog #6691](https://github.com/PostHog/posthog/issues/6691)

**OpenReplay CE**
- The baseline is 2 vCPU / 8 GB RAM / 50 GB storage per instance. The single-host Docker Compose path is described as for "evaluation, internal staging, or lightweight production" — [OpenReplay docs llms-full](https://docs.openreplay.com/llms-full.txt); [OpenReplay README](https://github.com/openreplay/openreplay)
- A 2022 RFC said "minimum 2 core 8G" is advisable (old) — [Discussion #658](https://github.com/openreplay/openreplay/discussions/658)
- The current compose (main, 2026-10-31) has postgresql, clickhouse, redis (OpenReplay valkey image), object storage, and the services alerts, api, images, sink, sourcemapreader, spot, storage, assets, assist, canvases, chalice, db, ender, frontend, http, nginx and caddy. The `minio` service now uses the **`rustfs/rustfs`** image, with a separate `ghcr.io/openreplay/minio:2025` image used only for `minio-migration`. Kafka is not in the compose — [OpenReplay docker-compose.yaml](https://raw.githubusercontent.com/openreplay/openreplay/main/scripts/docker-compose/docker-compose.yaml)

**Rybbit**
- The official compose pins clickhouse-server 26.3.17.4, postgres:17.4, redis 8.6.4, backend, client and caddy. It ships ClickHouse limits in config: `max_server_memory_usage_to_ram_ratio` 0.80, `merges_mutations_memory_usage_to_ram_ratio` 0.25, and per-query `max_memory_usage` 32 GB. Redis uses `noeviction`, and its comments say session keys have a 30-minute TTL — [Rybbit docker-compose.yml](https://raw.githubusercontent.com/rybbit-io/rybbit/master/docker-compose.yml)
- A third-party template reports about 0.9 GB idle across six services (ClickHouse 0.4 GB, backend 0.3 GB). It lists a 2 GB minimum and recommends 4 GB — [Server Compass template](https://servercompass.app/templates/rybbit)
- A Railway guide (third party) says a 1 GB ClickHouse "comfortably handles a few million events per month", and suggests 4-8 GB for high-traffic sites — [Railway Rybbit](https://railway.com/deploy/rybbit-analytics)
- Another comparison suggests a ~2 GB RAM minimum and ~1 GB for ClickHouse. It measured ClickHouse idle at 202 MiB — [Haloy comparison](https://haloy.dev/blog/self-hosted-analytics-compared)
- ClickHouse's default `max_server_memory_usage_to_ram_ratio` is 0.9 of host RAM. Without a cap, every ClickHouse-based stack on a shared box will try to use up to 90% — [ClickHouse docs](https://clickhouse.com/docs/reference/settings/server-settings/settings/max-server-memory-usage)

**OpenPanel**
- The docs recommend 2 vCPU / 4 GB RAM / 20 GB SSD, with ClickHouse as the main disk consumer — [OpenPanel self-hosting overview (Mintlify mirror)](https://openpanel-dev-openpanel-96.mintlify.app/self-hosting/overview)
- The current compose template has op-proxy (caddy), op-db (**postgres:14-alpine**), op-kv (redis 7.2.5, noeviction), op-ch (clickhouse 25.10.2.65), **op-rp (Redpanda v25.1.4 with `--memory=2G`**; the comment calls it "a single-node starting point"), op-api, op-dashboard and op-worker (`lindesvard/openpanel-*:3`) — [OpenPanel compose template](https://raw.githubusercontent.com/Openpanel-dev/openpanel/main/self-hosting/docker-compose.template.yml)

**Umami**
- The official compose is just `umami:latest` plus `postgres:15-alpine` — [Umami docker-compose.yml](https://raw.githubusercontent.com/umami-software/umami/master/docker-compose.yml)
- v3 dropped MySQL and supports only PostgreSQL. ClickHouse remains an optional analytics backend (v3.4.0 notes mention "PostgreSQL and ClickHouse timezone inconsistencies") — [Umami v3.0.0 release](https://github.com/umami-software/umami/releases/tag/v3.0.0); [v3.4.0 release](https://github.com/umami-software/umami/releases/tag/v3.4.0)

**Countly Lite / Matomo**
- Countly's install script assumes a fresh Ubuntu/CentOS/RHEL host with nothing on ports 80/443. It uses MongoDB, and Docker images exist — [Countly README](https://github.com/Countly/countly-server)
- Matomo runs only on MySQL/MariaDB, and Postgres is "unlikely to happen" — [Matomo FAQ](https://matomo.org/faq/how-to-install/faq_55/); [Matomo forum](https://forum.matomo.org/t/is-it-possible-to-run-piwik-matomo-on-postgresql/36295)

**Replay storage (DIY and general)**
- rrweb Cloud's fair-use guideline is ~5 MB average compressed payload per session. This is a ceiling, not a typical size — [rrweb FUP](https://rrweb.com/fup)
- Vendor marketing says a typical 5-minute recording is ~200 KB compressed vs ~1,000 KB raw — [rrweb Cloud](https://rrweb.com/product/cloud)
- An independent benchmark measured a ~50 s, 4-navigation session at 2.64 MB as JSON and ~377 KB gzipped (rrweb 2.1.7) — [Krama PR #179](https://github.com/NachikethaKG/Krama/pull/179)
- Statsig cannot display sessions over 50 MB. Its fix is turning off inline stylesheets — [Statsig replay debug](https://docs.statsig.com/session-replay/debug)

### Inferences
- From the per-session figures above (~200-400 KB compressed), 1,000 replays would take roughly 0.2-0.5 GB, and 100k replays/month roughly 20-50 GB/month. The 380 GB disk makes replay retention, not event volume, the binding disk constraint. Set replay retention to 30 days or less.
- On a shared 22 GB box, any ClickHouse-based tool should get an explicit memory cap (Rybbit already ships one at 0.8 of RAM, which is still too high for a shared host). Running two ClickHouse stacks (e.g. Rybbit + OpenReplay) doubles background merge load.
- PostHog hobby could physically run in the 22 GB of free RAM, but it would consume most of the box. Its own docs say the target volume (>1M/month) is beyond what the hobby deploy is designed for.

### Gaps
- No credible measured RAM/CPU readings at 1-5M events/month were found for any tool. All figures are minimums, idle readings, or third-party claims.
- No sourced "disk per million events" figure was found for any tool's ClickHouse or Postgres schema. Measure this with a load test.
- No sourced per-session storage figure for OpenReplay (docs do not state it) or for Matomo recordings (stored in MySQL).
- No 2025-2026 Reddit or HN threads with concrete measurements were retrieved within the time budget.

## 2. Upgrades, breaking changes, failure modes, backup

### Takeaway
PostHog has no versioned releases (you run `master`/`latest`), gives no data-loss recovery or support, and closes custom-config issues as unsupported. Umami, Rybbit, OpenPanel, OpenReplay and Countly cut normal tagged releases with auto-run migrations. All of them were actively maintained in October 2026.

### Cited Findings
- PostHog doesn't publish CVEs because it has no versioned releases; security fixes ship continuously from `master`. Upgrade with `bin/upgrade-hobby` and "back up all data before upgrading". You accept the risk of data loss — [PostHog self-host docs](https://posthog.com/docs/self-host)
- The installer warns: "PostHog don't create tagged releases anymore. It's way better to use 'latest' than 'latest-release'" — [deploy-hobby](https://raw.githubusercontent.com/PostHog/posthog/master/bin/deploy-hobby)
- PostHog says it "cannot answer tickets and cannot help debug" and is "unable to support recovery from data loss" for self-hosters — [PostHog disclaimer](https://posthog.com/docs/self-host/open-source/disclaimer.md)
- Hobby deploy Kafka errors ("max size reached for header"), Dec 2025: the maintainer closed the issue as not planned on 2026-10-08, saying custom Kafka message-size settings are unsupported on hobby — [PostHog #43915](https://github.com/PostHog/posthog/issues/43915)
- ClickHouse OOM during an async migration left about 4M person rows missing on a self-hosted 1.38.0 instance (old, 2022) — [PostHog #11283](https://github.com/PostHog/posthog/issues/11283)
- Hobby compose had to add persistent volumes for Kafka/Redis after Kafka offsets were lost on rebuild — [PostHog #22291](https://www.github.com/PostHog/posthog/issues/22291)
- OpenReplay's upgrade guide covers pre-upgrade backups, Helm/Docker steps and DB migrations. The docs support an external PostgreSQL "for production reliability and backups", and a Cleanup Storage page covers retention and manual cleanup — [OpenReplay docs llms-full](https://docs.openreplay.com/llms-full.txt)
- OpenReplay's object store has moved from MinIO to RustFS in the compose, with a minio-migration step. Treat this as an upgrade risk for existing MinIO volumes — [OpenReplay compose](https://raw.githubusercontent.com/openreplay/openreplay/main/scripts/docker-compose/docker-compose.yaml)
- Umami v3.0.0 (2025-11-07): MySQL dropped (breaking), with a migration guide. Later releases add Prisma migrations that "run automatically during the build process". v3.4.1 (2026-10-23) is a security hotfix (Next.js RCE in `next/og`, SSRF), and "All self-hosted users should upgrade" — [Umami releases](https://github.com/umami-software/umami/releases)
- Latest tags as of 2026-10-31: OpenReplay v1.28.0 (2026-09-25), Rybbit v2.9.2 (2026-10-24), Umami v3.4.1 (2026-10-23), Countly 24.05.55 (2026-10-30) — [GitHub releases API: OpenReplay](https://github.com/openreplay/openreplay/releases), [Rybbit](https://github.com/rybbit-io/rybbit/releases), [Countly](https://github.com/Countly/countly-server/releases)

### Inferences
- Backups for the ClickHouse-based tools are pg_dump of the small Postgres metadata DB plus ClickHouse `BACKUP` (or a volume snapshot with the stack stopped), plus the object-store bucket for OpenReplay and PostHog replays. Umami alone is fully covered by pg_dump, which fits the existing nightly Postgres dump to R2.
- PostHog's rolling `latest` model plus "no support" makes upgrades the riskiest of the set. Pin image digests in Komodo and snapshot before every pull.

### Gaps
- No documented backup procedure was found for Rybbit, OpenPanel or Countly within the time budget.
- No specific chalice-service failure reports were found.

## 3. Multi-tenant provisioning via API (and free-edition limits)

### Takeaway
Matomo (SitesManager/UsersManager), Umami (websites/teams/users with roles and API keys since v3.4) and Countly (/i/apps, /i/users) have complete, free provisioning APIs. Rybbit has orgs, roles, per-site member restrictions and org API keys. OpenPanel's Manage API covers projects and clients but not members. PostHog self-hosted free is hard-limited **in code** to one non-demo project per organization, and blocks a user who already has an org from creating another. RBAC and custom retention are paid-only.

### Cited Findings
**PostHog (self-hosted, no licence)**
- `posthog/api/project.py`: if the org lacks the `ORGANIZATIONS_PROJECTS` feature, "they can only have one non-demo project". With the feature, the hard maximum is `MAX_ALLOWED_PROJECTS_PER_ORG = 2000` — [project.py](https://raw.githubusercontent.com/PostHog/posthog/master/posthog/api/project.py)
- `posthog/api/organization.py`: when `not is_cloud()`, create and update add `PremiumMultiorganizationPermission`. That check denies org creation to a user who already belongs to an org without `ORGANIZATIONS_PROJECTS` ("You must upgrade your PostHog plan to be able to create and manage multiple organizations.") — [organization.py](https://raw.githubusercontent.com/PostHog/posthog/master/posthog/api/organization.py)
- Session-recording retention changes go through `verify_team_session_recording_retention_period`. It returns 403 if the requested period exceeds the org's `SESSION_REPLAY_DATA_RETENTION` entitlement — [project.py](https://raw.githubusercontent.com/PostHog/posthog/master/posthog/api/project.py)
- The self-host disclaimer lists what self-hosters lose: "Unlimited projects" (Teams), "RBAC", "Audit logs", "Custom data retention" (Enterprise), "One year event retention", group analytics, data pipelines, and "Download recordings" — [PostHog disclaimer](https://posthog.com/docs/self-host/open-source/disclaimer.md)
- "All paid-plan features are Cloud-only" — [PostHog self-host docs](https://posthog.com/docs/self-host)

**Matomo (GPL-3.0 core, MySQL/MariaDB)**
- `SitesManager.addSite`, `SitesManager.deleteSite`, `SitesManager.addSiteAliasUrls` and `SitesManager.getJavascriptTag` (fetch the tracking snippet) are public API methods — [SitesManager/API.php](https://raw.githubusercontent.com/matomo-org/matomo/5.x-dev/plugins/SitesManager/API.php)
- `UsersManager.addUser`, `inviteUser`, `deleteUser`, `setUserAccess` (per-site view/write/admin), `addCapabilities(userLogin, capabilities, idSites)`, `setSuperUserAccess` and `createAppSpecificTokenAuth` are also public — [UsersManager/API.php](https://raw.githubusercontent.com/matomo-org/matomo/5.x-dev/plugins/UsersManager/API.php)
- Retention via API: `PrivacyManager.setDeleteLogsSettings`, `setDeleteReportsSettings`, `executeDataPurge`, `deleteDataSubjects` and the anonymisation setters. These are instance-wide raw-data deletion settings, not per-site — [PrivacyManager/API.php](https://raw.githubusercontent.com/matomo-org/matomo/5.x-dev/plugins/PrivacyManager/API.php)
- The API is called with `token_auth` — [Matomo API reference](https://developer.matomo.org/api-reference/reporting-api)

**Umami (MIT)**
- Self-hosted API base is `http://<instance>/api`, authenticated first via `POST /api/auth/login` (Cloud uses `api.umami.is/v1` + API key) — [Umami API docs](https://docs.umami.is/docs/api)
- v3.4.0 (2026-09-17) added account API keys under Settings → API keys, "with existing user and team permissions", plus an MCP server — [Umami v3.4.0](https://github.com/umami-software/umami/releases/tag/v3.4.0)
- Route files on master include `/api/websites`, `/api/teams`, `/api/teams/[teamId]/users`, `/api/teams/[teamId]/users/[userId]`, `/api/teams/[teamId]/websites`, `/api/users`, `/api/users/[userId]`, `/api/admin/users`, `/api/admin/websites` and `/api/admin/teams` — [Umami repo tree](https://github.com/umami-software/umami/tree/master/src/app/api)
- Roles: global `admin`, `user`, `view-only`; team `team-owner`, `team-manager`, `team-member`, `team-view-only` — [Umami constants.ts](https://raw.githubusercontent.com/umami-software/umami/master/src/lib/constants.ts)

**Rybbit (AGPL-3.0)**
- Organization keys (`rb_org_`) are recommended for integrations. Only admins/owners can create them, and they survive members leaving. Personal keys carry the user's site restrictions. Auth is a Bearer header. Rate limits are per credential owner — [Rybbit API getting started](https://rybbit.com/pl/docs/api/getting-started)
- Roles are Owner, Admin and Member. Admins see all sites, while members see only assigned sites. Owners can invite or create user accounts — [Rybbit organization settings](https://rybbit.com/docs/organization-settings)
- A third-party review says orgs/teams and the API are the same in cloud and self-hosted, with email reports cloud-only (unverified) — [openapps.pro](https://openapps.pro/apps/rybbit)

**OpenPanel (AGPL-3.0)**
- The Manage API at `/manage` needs a **root client** ("organization-wide access"). It covers projects (create/update/delete), clients (read/write/root and their secrets) and references. Rate limit is 20 req / 10 s per client. Member/org management via API is not documented — [OpenPanel Manage API](https://openpanel.dev/docs/api/manage)

**Countly Lite (AGPL-3.0 + Section 7 branding terms)**
- `/i/apps/create` requires global admin. Management calls use `api_key` / auth token, while SDK writes use `app_key` — [Countly apps create](https://api.count.ly/api/core/apps/i-apps-create)
- `/i/users/create` "creates new users from values provided in args parameter as stringified JSON" — [Countly users create](https://api.count.ly/reference/iuserscreate); permission metadata endpoint: [o/users/permissions](https://api.count.ly/api/core/users/o-users-permissions)
- Docs warn that "some individual components might be partially or entirely restricted" in Lite vs Enterprise — [Countly management overview](https://support.countly.com/hc/en-us/articles/4404787116569)

**OpenReplay CE (AGPL-3.0 outside ee/)**
- The v2 public API uses an Organization API key as a Bearer token. The self-hosted base is `https://<domain>/v2/api` (routes under `/public`). Resource groups are Projects (create/retrieve, project keys), Sessions, Events, Users (search/delete), Jobs (deletion jobs) and Assist ("EE"). v1 `https://<domain>/api/` is deprecated — [OpenReplay API docs](https://docs.openreplay.com/en/api/)
- "Single-Sign-On (via SAML2) is available on OpenReplay Enterprise Edition only" — [OpenReplay SSO docs](https://docs.openreplay.com/en/configuration/sso/)
- The README lists Owner/Admin/Member roles without saying which edition has them — [OpenReplay README](https://github.com/openreplay/openreplay)
- A third-party comparison claims the free edition is capped at "50,000 sessions per month". This likely confuses it with the cloud free tier, so treat it as unverified — [PostHog comparison](https://posthog.com/blog/best-open-source-session-replay-tools)

### Inferences
- PostHog free self-host multi-tenancy only works as **one org = one project = one separate owner user** (a fresh signup creates a fresh org). There is no free path for one admin to manage several projects, and no RBAC. That makes it a poor fit for API-provisioned multi-project hosting.
- Umami is the cleanest provisioning model for many small apps: one admin API key, one team per tenant, websites in that team, and team roles for people.
- Matomo has the most mature per-site permission API, but it needs MySQL/MariaDB alongside PG17 and a paid plugin for replay.

### Gaps
- PostHog's REST paths are not shown here because the API docs pages didn't render. The standard shape is `/api/organizations/{id}/projects/`, `/invites/` and `/members/`, but it is not verified from a fetched doc.
- OpenReplay's exact project-create path and whether roles/members are in CE were not confirmed.
- Countly Lite's retention API and permission granularity, and whether heatmaps are in Lite, were not confirmed.
- Rybbit's and Umami's retention settings via API were not confirmed.

## 4. Data isolation: one instance for many unrelated projects?

### Takeaway
All tools isolate by site/project ID within a shared database. Isolation relies on app-level permission checks, not separate databases. That is fine for internal apps. Use org/team boundaries (Rybbit org, Umami team, PostHog org, Matomo per-site access) when tenants are unrelated people.

### Cited Findings
- Rybbit members see only assigned sites. Org API keys are org-scoped, and a personal key returns 403 for sites without access — [Rybbit org settings](https://rybbit.com/docs/organization-settings); [Rybbit API](https://rybbit.com/pl/docs/api/getting-started)
- Umami team roles and permissions gate websites per team — [Umami constants.ts](https://raw.githubusercontent.com/umami-software/umami/master/src/lib/constants.ts)
- Matomo `setUserAccess` and `addCapabilities` are per `idSites` — [UsersManager/API.php](https://raw.githubusercontent.com/matomo-org/matomo/5.x-dev/plugins/UsersManager/API.php)
- OpenPanel root clients have organization-wide access, so a leaked root secret exposes every project in the org — [OpenPanel Manage API](https://openpanel.dev/docs/api/manage)
- PostHog free allows one project per org, so in practice every tenant is its own org — [project.py](https://raw.githubusercontent.com/PostHog/posthog/master/posthog/api/project.py)

### Inferences
- Matomo's PrivacyManager raw-data deletion settings are instance-wide, so retention is per instance, not per tenant. Tenants needing different retention would need separate instances or per-site purges (inference from the method list).

### Gaps
- No independent security review of cross-tenant isolation was found for any of these tools.

## 5. Licences for an internal multi-project/multi-user platform

### Takeaway
MIT (Umami, PostHog outside `ee/`, rrweb) carries no restrictions. AGPL-3.0 (Rybbit, OpenPanel, OpenReplay outside `ee/`, Countly) is fine for internal use and for serving others. Its obligation only triggers if you **modify** the code and let others use it over a network: you must then offer them your modified source. Countly adds Section 7 branding terms (keep its logo and name). Matomo core is GPL-3.0, but the heatmap/replay plugin is commercial (InnoCraft EULA). Code under `ee/` in PostHog and OpenReplay is proprietary and should be avoided.

### Cited Findings
- PostHog: `ee/` is under `ee/LICENSE`, and the rest is "MIT Expat" — [PostHog LICENSE](https://raw.githubusercontent.com/PostHog/posthog/master/LICENSE)
- OpenReplay: `ee/` is under `ee/LICENSE`, some directories are MIT, and everything else defaults to AGPL v3 — [OpenReplay LICENSE](https://raw.githubusercontent.com/openreplay/openreplay/main/LICENSE). Its docs inconsistently mention "Elastic License 2.0" and "AGPLv2" — [OpenReplay llms-full](https://docs.openreplay.com/llms-full.txt)
- Rybbit `LICENSE.md` is GNU AGPL v3 — [Rybbit LICENSE.md](https://raw.githubusercontent.com/rybbit-io/rybbit/master/LICENSE.md). OpenPanel is AGPL-3.0 per the GitHub API — [OpenPanel repo](https://github.com/Openpanel-dev/openpanel)
- Umami is MIT — [Umami LICENSE](https://raw.githubusercontent.com/umami-software/umami/master/LICENSE). rrweb is MIT — [rrweb LICENSE](https://raw.githubusercontent.com/rrweb-io/rrweb/master/LICENSE)
- Countly: "AGPL-3.0 with modified Section 7… You cannot remove any Countly logo or branding… No other brands… may be used for derivative products" — [Countly LICENSE.md](https://raw.githubusercontent.com/Countly/countly-server/master/LICENSE.md)
- Matomo core is GPL-3.0 per the GitHub API — [matomo-org/matomo](https://github.com/matomo-org/matomo)
- The Heatmap & Session Recording plugin is under the InnoCraft EULA, priced around €219/yr for 1-4 users on-premise and rising with user count (secondary source; other sources quote different figures) — [opensource-analytics.com](https://opensource-analytics.com/matomo-heatmaps/); [Matomo pricing](https://matomo.org/pricing/)

### Inferences
- For an internal platform that only deploys unmodified upstream images, none of the licences restricts offering dashboards to other users or projects. Countly's branding terms block white-labelling. Matomo replay costs money per user tier.

### Gaps
- The exact current price and user-tier definition for Matomo's plugin were not confirmed on the InnoCraft marketplace.

## 6. Reusing the existing Postgres 17 and running under Docker/Komodo

### Takeaway
Umami can run entirely on the existing PG17 (Postgres-only since v3). Rybbit pins postgres:17.4, so its metadata DB matches PG17 exactly, but events still need ClickHouse. OpenPanel pins PG14 for metadata, plus ClickHouse and Redpanda. OpenReplay documents external Postgres, plus ClickHouse and an object store. PostHog bundles its own PG15 inside a tightly coupled stack. Matomo needs MySQL/MariaDB and Countly needs MongoDB, so neither can reuse PG17.

### Cited Findings
- Umami: "Umami v3 no longer supports MySQL… only PostgreSQL". The compose takes a plain `DATABASE_URL` — [Umami v3.0.0](https://github.com/umami-software/umami/releases/tag/v3.0.0); [Umami compose](https://raw.githubusercontent.com/umami-software/umami/master/docker-compose.yml)
- Umami v3.1 added rrweb-based Session Replay ("Per-visit recording"). v3.2 (2026-06-24) added click/scroll heatmaps "rendered from captured replay snapshots" with "Self-hosted heatmap recording and storage support", and chunks replay payloads and rejects oversized ones — [Umami v3.1.0](https://github.com/umami-software/umami/releases/tag/v3.1.0); [Umami v3.2.0](https://github.com/umami-software/umami/releases/tag/v3.2.0)
- Rybbit compose: postgres:17.4 + ClickHouse 26.3 + Redis — [Rybbit compose](https://raw.githubusercontent.com/rybbit-io/rybbit/master/docker-compose.yml)
- OpenPanel compose: postgres:14-alpine + ClickHouse + Redpanda + Redis — [OpenPanel compose](https://raw.githubusercontent.com/Openpanel-dev/openpanel/main/self-hosting/docker-compose.template.yml)
- OpenReplay supports pointing at an external PostgreSQL — [OpenReplay docs](https://docs.openreplay.com/llms-full.txt)
- PostHog hobby: postgres:15.12-alpine is part of the stack — [hobby compose](https://raw.githubusercontent.com/PostHog/posthog/master/docker-compose.hobby.yml)
- Matomo requires MySQL/MariaDB — [Matomo FAQ](https://matomo.org/faq/how-to-install/faq_55/). Countly requires MongoDB — [Countly README](https://github.com/Countly/countly-server)

### Inferences
- Umami's replay and heatmap data lands in the same Postgres. Putting it on the shared PG17 means replay volume (hundreds of KB per session) grows the main database, its WAL and the planned streaming replica and R2 dump. A separate database, or retention limits, is advisable if replay is enabled heavily. Where Umami stores replay blobs is not confirmed from source.
- Pointing Rybbit or OpenPanel at the external PG17 should mean overriding their DB connection env and removing the bundled postgres service. That is a standard compose edit for Komodo, but untested, and OpenPanel was built against PG14.
- All of these ship as Docker Compose files, so they import directly as Komodo stacks. Each bundles Caddy as a reverse proxy, which would need removing or re-porting if a proxy (e.g. cloudflared) already fronts the box.

### Gaps
- Not confirmed: whether Rybbit or OpenPanel officially document external Postgres env vars, and whether PostHog hobby supports an external Postgres at all.
- No source confirms how Umami stores replay data (Postgres table vs object storage) or its per-replay size.
