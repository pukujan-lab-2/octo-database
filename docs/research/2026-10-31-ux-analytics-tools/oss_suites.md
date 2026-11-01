# Open-source / self-hostable all-in-one product + UX analytics suites (state as of 2026-10-31)

Method note: GitHub stars, licence SPDX, last push, archived flag and latest release were pulled live from the GitHub REST API on 2026-10-31 (cited as "[GH API](repo URL)"). Feature/footprint claims come from official docs/READMEs where possible; third-party comparison blogs (often written by competing vendors, e.g. temps.sh, rybbit.com, openpanel.dev, swetrix.com) are flagged as such. Owner context: save money, UX work (heatmaps/replay/funnels), many small apps, >1M events/month, one ~16-22 GB server shared with other services.

### Quick activity table (GH API, 2026-10-31)

| Project | Stars | Licence (SPDX as GitHub reports) | Latest release | Status |
|---|---|---|---|---|
| PostHog | 40,554 | NOASSERTION (MIT + `ee/` proprietary) | rolling, no tagged self-host releases | very active — [GH](https://github.com/PostHog/posthog) |
| Umami | 39,835 | MIT | v3.4.1, 2026-10-23 | very active — [GH](https://github.com/umami-software/umami) |
| Plausible | 29,734 | AGPL-3.0 | v3.2.1, 2026-05-15 | active (CE releases slower) — [GH](https://github.com/plausible/analytics) |
| Matomo | 21,991 | GPL-3.0 | 6.1.0-alpha 2026-10-31 | very active — [GH](https://github.com/matomo-org/matomo) |
| rrweb | 20,332 | MIT | rrweb@2.2.0, 2026-10-24 | active — [GH](https://github.com/rrweb-io/rrweb) |
| Unleash | 13,918 | AGPL-3.0 (repo) | v8.3.1, 2026-10-29 | active — [GH](https://github.com/Unleash/unleash) |
| Formbricks | 13,202 | NOASSERTION (AGPL + EE) | 6.1.2, 2026-10-27 | active — [GH](https://github.com/formbricks/formbricks) |
| Rybbit | 13,193 | AGPL-3.0 | v2.9.2, 2026-10-24 | active — [GH](https://github.com/rybbit-io/rybbit) |
| OpenReplay | 13,083 | NOASSERTION (AGPLv3 + MIT dirs + `ee/` commercial) | v1.28.0, 2026-09-25 | active — [GH](https://github.com/openreplay/openreplay) |
| HyperDX (ClickStack) | 9,985 | MIT | otel-collector 2.43.0, 2026-10-30 | active — [GH](https://github.com/hyperdxio/hyperdx) |
| Sentry self-hosted | 9,630 | NOASSERTION (FSL/BSL family) | 26.10.1, 2026-10-29 | active — [GH](https://github.com/getsentry/self-hosted) |
| Highlight.io | 9,385 | NOASSERTION (Apache-2.0 per sources) | docker-v0.5.6, 2025-08-08 | effectively abandoned as product — [GH](https://github.com/highlight/highlight) |
| GrowthBook | 8,554 | NOASSERTION ("Other": MIT + enterprise dirs) | v5.1.0, 2026-09-22 | active — [GH](https://github.com/growthbook/growthbook) |
| Fathom Lite | 8,035 | MIT | v1.3.1, 2023-01-31 | stale (no release since Jan 2023) — [GH](https://github.com/usefathom/fathom) |
| OpenPanel | 7,227 | AGPL-3.0 | v3.18.2, 2026-10-30 | very active — [GH](https://github.com/Openpanel-dev/openpanel) |
| Snowplow (umbrella repo) | 7,048 | Apache-2.0 (umbrella) — core now SLULA | 22.01, 2022-01-31 | core components licence-changed — [GH](https://github.com/snowplow/snowplow) |
| GoatCounter | 6,125 | NOASSERTION (EUPL-1.2 per project) | v2.7.0, 2025-12-15 | maintained, slow cadence — [GH](https://github.com/arp242/goatcounter) |
| Countly server | 5,926 | NOASSERTION ("Other": AGPL + branding term) | 24.05.55, 2026-10-30 | active — [GH](https://github.com/Countly/countly-server) |
| Jitsu | 5,123 | MIT | 2.15.0-beta.98, 2026-10-28 | active — [GH](https://github.com/jitsucom/jitsu) |
| Ackee | 4,722 | MIT | v3.7.1, 2026-10-23 | maintained — [GH](https://github.com/electerious/Ackee) |
| RudderStack server | 4,511 | NOASSERTION (ELv2) | v1.92.1, 2026-10-28 | active — [GH](https://github.com/rudderlabs/rudder-server) |
| Shynet | 3,156 | Apache-2.0 | v0.14.0, 2026-03-15 | slow — [GH](https://github.com/milesmcc/shynet) |
| Tianji | 3,120 | Apache-2.0 | v1.33.13, 2026-10-27 | active — [GH](https://github.com/msgbyte/tianji) |
| Open Web Analytics | 2,695 | GPL-2.0 | 1.14.2, 2026-10-23 | maintained — [GH](https://github.com/Open-Web-Analytics/Open-Web-Analytics) |
| Vince | 2,010 | AGPL-3.0 | v1.11.8, 2025-09-01 | stale (last push 2025-09-01) — [GH](https://github.com/vinceanalytics/vince) |
| Aptabase | 1,862 | AGPL-3.0 | (no GitHub release objects) last push 2026-10-30 | maintained — [GH](https://github.com/aptabase/aptabase) |
| Litlyx | 1,748 | Apache-2.0 | v0.0.19, 2025-12-01 | stale (last push 2025-12-03) — [GH](https://github.com/Litlyx/litlyx) |
| Swetrix | 1,210 | AGPL-3.0 | tracker-js 4.8.0, 2026-10-20; CE image v5.4.1 2026-08-04 | active — [GH](https://github.com/Swetrix/swetrix) |
| Grafana Faro web SDK | 1,147 | Apache-2.0 | last push 2026-10-31 | active — [GH](https://github.com/grafana/faro-web-sdk) |
| Pirsch (Go library only) | 1,032 | AGPL-3.0 | v7.0.0, 2026-10-26 | library active; dashboard is SaaS — [GH](https://github.com/pirsch-analytics/pirsch) |
| PostHog FOSS mirror | 727 | MIT | — | mirror — [GH](https://github.com/PostHog/posthog-foss) |
| Medama | 640 | none reported | v0.6.2, 2026-01-18 | **ARCHIVED** on GitHub — [GH](https://github.com/medama-io/medama) |
| Liwan | 220 | Apache-2.0 | liwan-v1.8.2, 2026-10-29 | active, tiny — [GH](https://github.com/explodingcamera/liwan) |
| Usermaven | (usermaven-js SDK: 1 star) | MIT (SDK only) | — | no self-hostable server repo found — [GH](https://github.com/usermaven/usermaven-js) |

---

## Which OSS projects give heatmaps + session replay + funnels in the free self-hosted edition?

### Takeaway
As of Oct 2026 the realistic "all three in free self-host" set is: **PostHog (hobby)**, **OpenReplay CE** (heatmaps disputed), **Umami v3.2+** (replay + click/scroll heatmaps; funnels exist in Umami v2/v3 reports), and **Matomo** only if you pay ~€219/yr for the Heatmap & Session Recording plugin. **Rybbit** and **OpenPanel** give replay + funnels but **no heatmaps**. Umami's new replay/heatmaps (Apr/Jun 2026) are the most important 2026 change; they are young and thinly battle-tested.

### Cited Findings

**PostHog (self-hosted "hobby" Docker Compose)**
- Licence: repo is MIT except `ee/`, which is under `ee/LICENSE` — [WorldsOrg/posthog mirror README](https://github.com/WorldsOrg/posthog). The `ee` licence allows production use only with a PostHog Enterprise subscription; MIT code imports `ee` in ~500 places (368 imports), so deleting `ee/` stops Django booting; `posthog-foss` mirror fails the same way — [Jeremy Meidinger, 2026-09-17](https://jeremy-meidinger.de/blog/self-hosting-posthog-part-1/).
- Official: "All paid-plan features are Cloud-only"; self-hosted users get free-plan features; no tagged releases for self-host; "officially unsupported", no support, no CVEs published — [PostHog self-host docs](https://posthog.com/docs/self-host).
- Feature set (product analytics, session replay, feature flags, A/B tests, surveys) is the same codebase as Cloud — [temps.sh (vendor blog)](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026); [PostHog self-host docs](https://posthog.com/docs/self-host). PostHog also has heatmaps/autocapture in its product (not separately verified for hobby in this pass — see Gaps).
- Free plan includes **1 project**; 6 projects requires a card on file — [PostHog pricing](https://posthog.com/pricing); [usercall.co](https://usercall.co/post/posthog-pricing). Since self-host = free-plan features, self-host is likely limited to free-plan project count (an older PostHog forum answer explicitly said "only one project" on the free OSS deploy, ~4 years old) — [PostHog community Q](https://posthog.com/questions/self-hosted-version).
- RBAC listed under Enterprise tier; Boost includes unlimited projects, SSO enforcement, white-labeling — [PostHog platform packages](https://posthog.com/platform-packages) (as summarised in search; page fetch returned truncated content). Third-party prices: Boost $250/mo, Scale $750/mo, Enterprise $2,000/mo — [DEV pricing teardown](https://dev.to/beton/posthog-pricing-teardown-2026-57oo) (unverified).
- ee-gated items named by a 2026 self-hoster: access control, group analytics and experiments APIs, AI assistant — [Meidinger](https://jeremy-meidinger.de/blog/self-hosting-posthog-part-1/).

**OpenReplay CE**
- Licence: mostly AGPLv3, some MIT dirs, `ee/` under separate commercial licence — [OpenReplay GitHub](https://github.com/openreplay/openreplay).
- README feature list: session replay, DevTools (network, console, JS errors, store state, 40+ perf metrics), product analytics (funnels, trends, journeys, **heatmaps**, web analytics), Assist co-browsing (live view, remote control, WebRTC calls), mobile replay iOS/Android, privacy masking (CSS selector, input redaction, network payload sanitisation, "private mode"), roles Owner/Admin/Member, SSO SAML/OIDC (edition not labelled) — [OpenReplay GitHub](https://github.com/openreplay/openreplay).
- Conflict: temps.sh says OpenReplay has "no built-in heatmaps" — [temps.sh (competitor)](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026); README says heatmaps are in product analytics — [GitHub](https://github.com/openreplay/openreplay).
- CE includes replay, session search, DevTools, funnels and co-browsing (third-party) — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026); [OpenReplay pricing search summary](https://openreplay.com/pricing/).
- Enterprise adds (third-party): enhanced co-browsing, SCIM, SSO with custom IdP groups, video export, under proprietary EE licence — [rrweb.com blog](https://rrweb.com/blog/rrweb-vs-openreplay); Enterprise = SAML/SCIM, audit logging, dedicated support, multi-year contract — [OpenReplay pricing](https://openreplay.com/pricing/).
- Official open-source page describes the free tier as "up to 50K sessions per month" — [OpenReplay open-source page](https://openreplay.com/solutions/size/open-source/) (unclear if a hard cap or a sizing guide).

**Umami (v3.1+/v3.2+)**
- v3.1.0 (April 2026): Boards + Session Replay (rrweb; clicks, scroll, input) — [Umami releases](https://github.com/umami-software/umami/releases); [Heise 3.1](https://www.heise.de/en/news/Web-analysis-without-Google-Umami-3-1-brings-replays-and-custom-dashboards-11270984.html).
- v3.2.0 (June 2026): click and scroll heatmaps, "self-hosted heatmap recording and storage support"; heatmaps built from snapshots of recorded sessions, filterable by path and screen width — [v3.2.0 release](https://github.com/umami-software/umami/releases/tag/v3.2.0); [Heise 3.2](https://www.heise.de/en/news/Umami-3-2-0-Heatmaps-and-improved-web-analytics-11347552.html).
- Self-host free with no per-session charge; Node.js + PostgreSQL; on Umami Cloud replay/heatmaps need Business plan $200/mo incl. 5,000 replays — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026). Conflict: DreamHost says replay/heatmaps start at Cloud Business; release notes support self-host availability — [DreamHost](https://www.dreamhost.com/hosting/vps/umami/); [Cloudzy review](https://cloudzy.com/blog/umami-review/).
- Replay retention 30 days per replay docs (Cloudzy summary) — [Cloudzy](https://cloudzy.com/blog/umami-review/).
- Licence MIT, no ee split — [GH API](https://github.com/umami-software/umami).

**Rybbit**
- AGPL-3.0; features: funnels, journeys, retention, session replay, error tracking, organisations + unlimited sites; web vitals Cloud/paid only; heatmaps not mentioned — [Rybbit GitHub](https://github.com/rybbit-io/rybbit).
- "Rybbit doesn't have heatmaps" (suggests Clarity) — [analytics-alternatives.com](https://analytics-alternatives.com/tools/rybbit/); replay opt-in via `sessionReplay: true` / `@rybbit/replay`, inputs auto-masked — [Rybbit session replay page](https://rybbit.com/features/session-replay).
- Self-host feature set = cloud (orgs/teams identical) — [openapps.pro](https://openapps.pro/apps/rybbit).

**OpenPanel**
- Funnels, cohorts, retention, user profiles, session history, A/B testing, alerts — [OpenPanel developers page](https://openpanel.dev/for/developers); self-hosted has same features as cloud, "no artificial limits" — [OpenPanel self-host docs](https://openpanel.dev/docs/self-hosting/v2/get-started).
- Session replay exists (rrweb-based, off by default, `sessionReplay: { enabled: true }`, chunks every 10 s, 30-day storage, `maskAllInputs` default true) — [OpenPanel session replay feature](https://openpanel.dev/features/session-replay); [OpenPanel replay docs](https://openpanel.dev/docs/session-replay). No heatmaps found in any source.
- Licence AGPL-3.0 — [GH API](https://github.com/Openpanel-dev/openpanel).

**Matomo + Heatmap & Session Recording (InnoCraft premium plugin)**
- Core GPL-3.0 — [GH API](https://github.com/matomo-org/matomo). Heatmaps + session recording via paid plugin "From 219EUR/year" On-Premise, priced by number of users, 30-day trial — [Matomo pricing](https://matomo.org/pricingforai/); [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026). Other quoted prices ($269, €199, €149) conflict and are older/third-party — [Pulsetic](https://pulsetic.com/matomo-alternative/); [Plerdy](https://www.plerdy.com/blog/matomo-alternatives/).
- Funnels in Matomo On-Premise are also a premium plugin (not verified this pass — see Gaps).

**Swetrix**
- Conflict on replay: README says "Session replays: Included; requires S3-compatible storage for CE"; wiki lists replays as Cloud-only — [Swetrix GitHub](https://github.com/swetrix/swetrix); [Swetrix wiki](https://github.com/Swetrix/swetrix/wiki). Bug: CE v5.4.1 shows Replays tab but tracker gets 404; "no Community Edition release after v5.4.1 (2026-08-04)" — [issue #617](https://github.com/Swetrix/swetrix/issues/617); [selfhosting PR #25](https://github.com/Swetrix/selfhosting/pull/25). No heatmap evidence. CE hard-codes 50 goals/project — [issue #619](https://github.com/Swetrix/swetrix/issues/619).

**Countly Lite vs Enterprise**
- Lite = "essential plugins", free, open source; Enterprise adds plugins, granular data (Drill), SLA, support — [Countly README](https://cdn.jsdelivr.net/gh/countly/countly-server@main/README.md). Licence AGPL-3.0 + term forbidding removal of Countly branding — [analytics-alternatives.com](https://analytics-alternatives.com/tools/countly/).
- Conflicting third-party claims on whether Lite has funnels/heatmaps (one says no funnels/retention/cohorts/heatmaps in Lite; another says Lite has funnels; heatmaps gated to Flex/Enterprise) — [analytics-alternatives.com](https://analytics-alternatives.com/tools/countly/); [toolradar](https://toolradar.com/tools/countly). No session replay in Countly per any source found.

**Observability-with-replay options**
- HyperDX/ClickStack (MIT): ClickHouse + OTel collector + HyperDX UI; session replay via `@hyperdx/browser` records sessions, console, network; stored in `hyperdx_sessions` table — [ClickHouse ClickStack session replay docs](https://clickhouse.com/docs/use-cases/observability/clickstack/session-replay). No heatmaps/funnels (observability tool).
- Sentry self-hosted: session replay is part of Sentry; min 4 cores, 16 GB RAM + 16 GB swap, 32 GB recommended — [Sentry self-hosted dev docs](https://develop.sentry.dev/self-hosted/); operators report 24-32 GB in practice — [urgentry guide](https://urgentry.com/guides/self-hosting/sentry-self-hosted-ram/) (vendor of an alternative). Repo self-describes as "packaged up for low-volume deployments and proofs-of-concept" — [GH API](https://github.com/getsentry/self-hosted).
- SigNoz: no session replay; Oct 2024 community answer "not part of our roadmap currently" — [SigNoz community](https://community-chat.signoz.io/t/23192903/do-signoz-has-plans-to-add-feature-of-session-replay-for-fro); [GitHub discussion #3846](https://github.com/SigNoz/signoz/discussions/3846).
- Grafana Faro: RUM SDK; packages are `core`, `react`, `web-sdk`, `web-tracing` — no replay package in the repo — [GH API faro-web-sdk](https://github.com/grafana/faro-web-sdk).

**Highlight.io**
- Acquired by LaunchDarkly (Mar/Apr 2025; sources differ on date) — [VMblog](https://vmblog.com/news/launchdarkly-acquires-highlight-to-advance-the-future-of-guarded-software-releases/); [YC profile](https://www.ycombinator.com/companies/highlight-io). Hosted service shut down 2026-02-28; self-hosters had to repoint SDKs before 2026-03-01 — [Bex blog](https://bex.co/blog/2026/07/12/highlightio-launchdarkly-shutdown-observability). Repo public, Apache-2.0, "technically self-hostable but unsupported, no upgrade path" — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026). Last docker release 2025-08-08 — [GH API](https://github.com/highlight/highlight). LaunchDarkly has no self-hosted edition — [software-lifecycle.com](https://software-lifecycle.com/sites/launchdarkly).

**rrweb (DIY)**
- MIT; serialises DOM snapshots + mutations, mouse, scroll, input; you build storage, playback UI, search, access control; used by PostHog, Sentry, Highlight, OpenReplay — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026). OpenPanel and Umami replays are also rrweb-based — [OpenPanel](https://openpanel.dev/features/session-replay); [Heise](https://www.heise.de/en/news/Web-analysis-without-Google-Umami-3-1-brings-replays-and-custom-dashboards-11270984.html).

**Temps (newer 2025-2026 candidate)**
- MIT/Apache-2.0, single binary + TimescaleDB; rrweb replay off by default, input masking on, 15-day fixed retention, no heatmaps, no console/network capture; v0.1.0-beta.7 May 2026 — [temps.sh (self-published)](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026). Beta; GitHub repo not found under `temps-sh/temps`.

**Tianji**
- Apache-2.0; website analytics + uptime + server status; surveys/telemetry on roadmap; no replay, heatmaps or funnels mentioned; Docker + PostgreSQL — [Tianji GitHub](https://github.com/msgbyte/tianji).

### Inferences
- For heatmaps + replay + funnels with zero licence cost and a simple stack, Umami 3.2+ is the new front-runner on paper; OpenReplay is the most mature replay-first tool; PostHog has the widest feature set but heaviest stack and single-project free-plan limits.
- A practical combo for the owner could be Rybbit or OpenPanel (analytics + funnels + replay) plus Umami/OpenReplay for heatmaps — but running two trackers doubles client overhead.
- Pure web-analytics tools (Plausible CE, GoatCounter, Ackee, Shynet, Offen, Fathom Lite, Liwan, Vince, Litlyx, Medama, Aptabase, Pirsch, Tianji) have no replay or heatmaps per available sources — useful only as lightweight traffic counters.

### Gaps
- Did not verify PostHog hobby specifics for heatmaps/toolbar and autocapture working on self-host (assumed same codebase).
- OpenReplay heatmap availability in CE is contradictory between README and a competitor blog.
- Umami funnels/journeys/retention were not re-verified against v3 docs in this pass (believed present in Umami reports since v2.x).
- Matomo funnels/A-B/form analytics premium plugin prices not fetched.
- Rage/dead-click and scroll-depth support per tool not systematically verified (PostHog, OpenReplay, Rybbit claim some frustration signals in marketing; Umami heatmaps include scroll).
- Countly official feature comparison page was not retrieved; Lite feature list remains disputed.
- No source found on whether Swetrix has heatmaps.

## What exactly is paywalled in each?

### Takeaway
PostHog self-host = free-plan features only (1 project, no RBAC/SSO, ee code legally needs an Enterprise subscription for production). OpenReplay CE keeps replay/devtools/funnels/assist but pushes SAML/SCIM/audit/advanced co-browse/video export to Enterprise. Plausible CE drops funnels, revenue goals, Sites API, SSO and strong bot filtering. Countly Lite drops Drill and many plugins. Formbricks CE caps at 3 projects. GrowthBook and Unleash gate SSO/advanced RBAC/change requests. Snowplow core is no longer OSS for production HA use.

### Cited Findings
- **PostHog**: "All paid-plan features are Cloud-only" — [PostHog self-host docs](https://posthog.com/docs/self-host); free plan 1 project, card-on-file 6 projects — [PostHog pricing](https://posthog.com/pricing); RBAC = Enterprise, unlimited projects/SSO enforcement = Boost — [platform packages](https://posthog.com/platform-packages); PostHog no longer sells a self-hosting licence — [search summary of PostHog sources](https://posthog.com/questions/self-hosted-version); Kubernetes/Helm deployments no longer supported, Helm chart unmaintained since 2023-05-31 — [Meidinger](https://jeremy-meidinger.de/blog/self-hosting-posthog-part-1/).
- **OpenReplay**: Open-Source free / Dedicated from $199/mo ($0.276/hr; SSO included; up to 32 GB RAM, 8 vCPU, 4 TB) / Enterprise custom (SAML/SCIM, audit logging) — [OpenReplay pricing](https://openreplay.com/pricing/). EE-only per third party: enhanced co-browsing, SCIM, SSO w/ custom IdP groups, video export — [rrweb.com](https://rrweb.com/blog/rrweb-vs-openreplay). Conflict: pricing puts SSO in Dedicated, third party says Enterprise-only.
- **Plausible CE**: funnels and revenue goals Cloud-only; also marketing funnels, user journeys, ecommerce revenue goals, SSO, Sites API, advanced bot detection hosted-only; Stats API v2 available on CE; CE releases slower, community support only — [opensource-analytics.com](https://opensource-analytics.com/plausible-ce-self-hosted-deployment/); [Plausible open-source page](https://plausible.io/open-source-website-analytics).
- **Countly**: Lite = essential plugins; Enterprise adds plugins, Drill granular data, SLA — [Countly README](https://cdn.jsdelivr.net/gh/countly/countly-server@main/README.md); SSO, white-label in Enterprise — [toolradar](https://toolradar.com/tools/countly).
- **Matomo**: core free; Heatmap & Session Recording ≥€219/yr On-Premise (user-tiered) — [Matomo pricing](https://matomo.org/pricingforai/).
- **Swetrix CE**: replay reportedly Cloud-only per wiki, revenue analytics and AI Cloud-only — [dev.co review](https://dev.co/observability/open-source/swetrix); [Swetrix wiki](https://github.com/Swetrix/swetrix/wiki).
- **Rybbit**: web vitals Cloud/paid only; replay included in self-host — [Rybbit GitHub](https://github.com/rybbit-io/rybbit); [analytics-alternatives.com](https://analytics-alternatives.com/tools/rybbit/).
- **OpenPanel**: "same features as cloud, no artificial limits" — [OpenPanel self-host docs](https://openpanel.dev/docs/self-hosting/v2/get-started).
- **Formbricks**: core AGPLv3; EE unlocked by `ENTERPRISE_LICENSE_KEY`, daily licence check against ee.formbricks.com; CE 3 projects vs EE unlimited, unlimited users both; commercial self-hosting needs no EE licence — [Formbricks licence docs](https://formbricks.com/docs/self-hosting/license). Third parties claim 2-user cap (contradicts official) — [fomr.io](https://fomr.io/blog/best-open-source-form-builders).
- **GrowthBook**: open core, MIT majority + "GrowthBook Enterprise License" dirs; enterprise features via `LICENSE_KEY` — [sourcepulse](https://www.sourcepulse.org/projects/567664); [Railway template](https://railway.com/deploy/self-host-growthbook.md).
- **Unleash**: Apache-2.0 core (GitHub reports AGPL-3.0 for the repo — conflict); Enterprise-only SSO, advanced RBAC, change requests; ~$75/user/mo, min 5 users (third party) — [statsig comparison](https://statsig.com/perspectives/growthbook-and-unleash-compared); [tech-insider](https://tech-insider.org/?p=18557); [GH API](https://github.com/Unleash/unleash).
- **Snowplow**: from 2024-01-08 Collector, Enrich, loaders and Iglu Server released under SLULA; production/HA use requires licence; Apache-2.0 fork OpenSnowcat exists — [Snowplow announcement](https://snowplow.io/blog/introducing-snowplow-limited-use-license); [Snowcat Cloud](https://www.snowcatcloud.com/snowplow/open-source/).
- **RudderStack server**: GitHub reports NOASSERTION (Elastic License 2.0 per project history, not re-verified) — [GH API](https://github.com/rudderlabs/rudder-server). **Jitsu**: MIT — [GH API](https://github.com/jitsucom/jitsu). Both are Segment-alternative pipelines, no UX UI — repo descriptions — [Jitsu](https://github.com/jitsucom/jitsu); [RudderStack](https://github.com/rudderlabs/rudder-server).
- **Sentry**: licence NOASSERTION on GitHub (FSL — not re-verified here) — [GH API](https://github.com/getsentry/self-hosted).

### Inferences
- For "many small apps", PostHog self-host's single-project free plan is the biggest blocker; workarounds (one project, filter by `$host`) lose per-app isolation.
- OpenReplay CE, OpenPanel, Rybbit and Umami appear to support multiple projects/sites in the free edition with no project caps found.

### Gaps
- Exact OpenReplay CE vs EE matrix (roles, assist, SSO) not retrievable — pricing page tick marks did not render in fetch.
- PostHog platform-packages page content truncated; RBAC/SSO tier placement comes from search snippets.
- RudderStack and Sentry exact licence names not re-verified.

## Which can run in under ~12 GB RAM on one server alongside other services?

### Takeaway
Comfortably under 12 GB: Umami (Node + Postgres), Plausible CE (~2 GB), Rybbit (2 GB min, ClickHouse), OpenPanel (4 GB min, ClickHouse+Postgres+Redis), OpenReplay (8 GB baseline), Matomo (PHP/MySQL), Tianji, all lightweight counters. **Not** comfortable: PostHog hobby (official 16 GB, 23 containers, ~19 GB images) and Sentry self-hosted (16 GB + swap, 32 GB recommended). HyperDX/ClickStack footprint not verified.

### Cited Findings
- **PostHog hobby**: official "4 vCPU, 16GB RAM, >30GB storage"; justify self-host only above ~300k events / 1k recordings / 300k flag calls — [PostHog self-host docs](https://posthog.com/docs/self-host). README says ~100k events/month guidance, 4 GB recommended (older wording) — [PostHog GitHub](https://github.com/posthog/posthog). Installer: "You REALLY need 8GB or more"; 23 services incl. Postgres 15, Redis 7, ClickHouse, Elasticsearch, SeaweedFS, object storage, Kafka, ZooKeeper, Temporal (4 services), web/worker/plugins, 6 ingestion services, Caddy; ~19 GB of images, posthog image 10.8 GB; requires real domain + Let's Encrypt; test 2026-05-07 never reached running stack — [onout.org/SimpleReview](https://onout.org/posthog/). Real deploy: 8 vCPU/32 GB node, ~42 pods, Django pods ~1 GB each, first boot ~1 hour, silent failures — [Meidinger 2026-09-17](https://jeremy-meidinger.de/blog/self-hosting-posthog-part-1/). Practical estimate 16 GB w/ SSD, $40-80/mo VPS — [onout.org](https://onout.org/posthog/). DEV post: "12 hours debugging" — [dev.to](https://dev.to/ismailmirza/i-spent-12-hours-debugging-posthog-self-hosting-so-you-dont-have-to-pb0).
- **OpenReplay**: baseline single VM 2 vCPU, 8 GB RAM, 50 GB storage — [OpenReplay GitHub](https://github.com/openreplay/openreplay); Docker Compose ~30 min, S3-compatible storage (MinIO/R2); tracker ~26 KB br — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026).
- **Plausible CE**: ≥2 GB RAM recommended, CPU with SSE 4.2/NEON (ClickHouse), Postgres + ClickHouse — [Plausible CE README mirror](https://git.bbaovanc.com/configs/plausible/src/branch/master/README.md).
- **Rybbit**: official ≥2 GB RAM; Postgres (users/orgs/sites) + ClickHouse (events) + Caddy; setup script + Docker Compose — [Rybbit self-hosting docs](https://rybbit.io/docs/self-hosting); [analytics-alternatives.com](https://analytics-alternatives.com/tools/rybbit/).
- **OpenPanel**: min 2 vCPU / 4 GB, Ubuntu 22.04, domain; services op-ch (ClickHouse), op-api, op-dashboard, op-worker, Postgres, Redis, proxy — [OpenPanel Docker docs (Mintlify mirror)](https://openpanel-dev-openpanel-96.mintlify.app/self-hosting/docker); third party suggests 4 vCPU/8 GB/80 GB — [openpanel.dev article](https://openpanel.dev/articles/self-hosted-web-analytics).
- **Umami**: Node.js + PostgreSQL only — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026).
- **Matomo**: PHP/MySQL — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026).
- **Tianji**: Docker Compose app + PostgreSQL — [Tianji GitHub](https://github.com/msgbyte/tianji).
- **Sentry**: 4 cores, 16 GB RAM + 16 GB swap minimum, 32 GB recommended — [Sentry dev docs](https://develop.sentry.dev/self-hosted/).
- **HyperDX/ClickStack**: ClickHouse + OTel collector + HyperDX (Mongo for metadata in classic deploy — not verified) — [ClickStack docs](https://clickhouse.com/docs/use-cases/observability/clickstack/session-replay).

### Inferences
- With >1M events/month across many small apps, ClickHouse-backed tools (Rybbit, OpenPanel, Plausible CE, OpenReplay, PostHog) scale far better than Postgres-only Umami for event volume; Umami replay/heatmap storage growth on Postgres is untested at volume (it stores rrweb payloads).
- OpenReplay (8 GB baseline) + another service on a 16-22 GB box is feasible but tight; Rybbit/OpenPanel (2-4 GB) leave the most headroom.

### Gaps
- No credible public benchmark found for "events/month on one box" for Rybbit, OpenPanel, Umami v3 replay, or OpenReplay CE. PostHog's only datapoint is the 2026 Meidinger k8s load test (~400k events/min on 8 vCPU/32 GB, mostly trace spans).
- No HN/Reddit first-hand 16-22 GB single-server reports were retrieved in this pass.
- HyperDX RAM requirements not retrieved.

## Which have a usable API to create projects and manage users programmatically?

### Takeaway
Best-documented provisioning APIs: **OpenReplay** (POST `/public/projects` or `/api/v1/projects` returns `projectKey`, org API key auth), **Umami** (`POST /websites`, `/teams`, `/users`), **Matomo** (`SitesManager.addSite`, `UsersManager.addUser/inviteUser/setUserAccess`, superuser token), **Rybbit** (REST API with org/personal bearer keys), **PostHog** (full REST API, but self-host free plan = 1 project). Plausible CE lacks the Sites API (hosted-only).

### Cited Findings
- **OpenReplay**: v2 `POST /public/projects` {name, platform web|ios} with Bearer org API key, returns `projectKey`; `GET /public/projects/:projectKey`; v1 `POST /api/v1/projects`; Org API key under Preferences > Account — [OpenReplay API docs](https://docs.openreplay.com/en/api/projects); [apis.io OpenAPI](https://apis.io/apis/openreplay/openreplay-projects-api/); [docs index](https://docs.openreplay.com/llms.txt).
- **Umami**: API client maps `POST /websites`, CRUD `/websites/{id}`, `POST /teams`, `POST /teams/join`, `POST /users`, team-website attach, team members — [Umami API client docs](https://docs.umami.is/docs/api/api-client); PHP client wraps create website/user/team — [adriengras/umami-php](https://packagist.org/packages/adriengras/umami-php). Self-host auth: login token vs API key — conflicting — [Glama MCP](https://glama.ai/mcp/servers/eu7zmt1bir); [coqui toolkit](https://packagist.org/packages/carmelosantana/coqui-toolkit-umami-admin).
- **Matomo**: UsersManager API requires superuser token_auth; `SitesManager.addSite` (use `method=`); `UsersManager.inviteUser` with `initialIdSite`, `expiryInDays` (default view access) — [Matomo FAQ users API](https://matomo.org/faq/general/managing-users-with-the-api-advanced/); [SitesManager API.php](https://github.com/matomo-org/matomo/blob/fb91155043c2dd269f32e27962e3cbdb00ad0aad/plugins/SitesManager/API.php); [forum](https://forum.matomo.org/t/need-to-auto-add-websites-via-api-or-upload/13873).
- **Rybbit**: REST API with "Organization keys or personal keys, rate-limited per plan" — [Rybbit for developers](https://rybbit.com/for-developers); orgs/teams identical self-host vs cloud — [openapps.pro](https://openapps.pro/apps/rybbit).
- **Plausible CE**: Sites API hosted-only; Stats API v2 on CE — [opensource-analytics.com](https://opensource-analytics.com/plausible-ce-self-hosted-deployment/).
- **Tianji**: OpenAPI is a roadmap item (completion unclear) — [Tianji GitHub](https://github.com/msgbyte/tianji).
- **Retention settings**: Rybbit self-hosters choose retention; cloud replay 30 days — [Rybbit replay page](https://rybbit.com/features/session-replay); OpenPanel replay 30 days — [OpenPanel](https://openpanel.dev/features/session-replay); Umami replay 30 days — [Cloudzy](https://cloudzy.com/blog/umami-review/); OpenReplay open-source retention "self-managed" — [OpenReplay pricing](https://openreplay.com/pricing/); Temps fixed 15 days — [temps.sh](https://temps.sh/blog/best-self-hosted-session-replay-tools-2026).

### Inferences
- For automated "new small app → new project + tracking key" provisioning (Octo-style), OpenReplay and Umami have the cleanest documented flows; Matomo works but needs a superuser token.
- PostHog's API is rich, but the self-host free plan's 1-project limit undermines per-app isolation.

### Gaps
- OpenPanel's project/client creation API and per-project member permissions were not verified.
- PostHog self-host API for org/project creation and invites not verified for the free plan.
- Per-project permission isolation in free editions (who can see which site) not verified for OpenReplay CE, Rybbit, OpenPanel, Umami (Umami teams suggest site-level grouping).
- Formbricks, GrowthBook, Unleash provisioning APIs not researched in this pass.
