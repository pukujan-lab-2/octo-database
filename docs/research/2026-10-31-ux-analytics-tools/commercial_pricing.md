# Commercial / cloud UX and product analytics tools: pricing and features (as of 2026-10-31)

Method note: figures come from official pricing pages and docs fetched on 2026-10-31 unless flagged. Where vendors hide prices, third-party estimates are labelled as such. "Event" means an analytics event; "session/replay" means one recorded browser session. Tiered math assumes graduated tiers (each band priced at its own rate), which is how PostHog's table reads; Sentry does not say whether its tiers are graduated, so its math is approximate.

## Which tools are genuinely cheapest at >1M events/month with replays and heatmaps?

### Takeaway
On published list prices, Statsig is cheapest for events + replay ($0 up to 2M events and 50k replays; $150/mo Pro covers 5M events and 100k replays). PostHog Cloud is next, with published usage pricing that includes heatmaps (about $153/mo at 5M events, $643/mo at 20M anonymous events, +$272.50/mo for 100k replays). Mixpanel costs about 3-4x PostHog for the same events. For replay + heatmaps alone, Clarity is free and Contentsquare (the old Hotjar) Free/Growth or Mouseflow are the cheap paid options. Enterprise DXA tools (FullStory paid, Glassbox, Quantum Metric, Pendo, Heap Pro) are quote-only and run to tens of thousands of dollars a year.

### Cited Findings

**Cost table (list prices, USD/month; math shown below)**

| Tool | 1M events | 5M events | 20M events | 5k replays | 25k replays | 100k replays | Heatmaps |
|---|---|---|---|---|---|---|---|
| Statsig | $0 | $150 (Pro) | ~$900 | $0 | $0 | $150 (Pro incl.) | not listed |
| PostHog (anonymous events) | $0 | $152.90 | $643.40 | $0 | $85 | $272.50 | yes, free to ingest |
| PostHog (all events identified) | $0 | $560.00 | $1,927.50 | as above | as above | as above | yes |
| Mixpanel Growth | $0 | $613 ($438 annual) | $2,289 ($1,635 annual) | incl. (20k on Growth) | add-on, price unlisted | add-on, price unlisted | yes |
| Amplitude | $0 (Free to 2M) | Plus, price unpublished | Plus (to 70M), unpublished | incl. (10k) | add-on, unpublished | add-on, unpublished | Plus and up |
| Datadog (replay only, annual) | n/a | n/a | n/a | $12.50 + RUM | $62.50 + RUM | $250 + RUM | with replay |
| Sentry (Team, PAYG) | n/a | n/a | n/a | ~$47.56 | ~$118.82 | ~$386.05 | no |
| Mouseflow | n/a | n/a | n/a | $25 | $109 | $319 | yes |
| Contentsquare (ex-Hotjar) | n/a | n/a | n/a | Free (5% capture, max 10k) | Growth from $39-49 | Pro, custom | yes |
| LogRocket | n/a | n/a | n/a | ? | ~$176 (annual) | Pro, unlisted | yes |
| Microsoft Clarity | n/a | n/a | n/a | $0 | $0 | $0 | yes |

**PostHog Cloud**
- Free tier per month: 1M analytics events, 5,000 web recordings, 2,500 mobile recordings, 1M feature-flag requests (experiments bundled with flags), 1,500 survey responses, 1M data-warehouse rows, 100k exceptions. Free plan: 1 project, 1-year retention, community support. Paid plan: $0 base, 6 projects, 7-year retention, email support — [PostHog pricing.md](https://posthog.com/pricing.md)
- Event bands: 1-2M $0.00005; 2-15M $0.0000343; 15-50M $0.0000295; 50-100M $0.0000218; 100-250M $0.000015; >250M $0.000009. Identified-events (person profiles) add-on on top: 1-2M $0.000198; 2-15M $0.0000697; 15-50M $0.000036; and lower after that — [PostHog pricing.md](https://posthog.com/pricing.md)
- Math, anonymous events: 5M = 1M x 0.00005 ($50) + 3M x 0.0000343 ($102.90) = **$152.90**. 20M = $50 + 13M x 0.0000343 ($445.90) + 5M x 0.0000295 ($147.50) = **$643.40**. — calculated from [PostHog pricing.md](https://posthog.com/pricing.md)
- Math, identified add-on: 5M = 1M x 0.000198 ($198) + 3M x 0.0000697 ($209.10) = $407.10 extra, **$560.00 total**. 20M = $198 + 13M x 0.0000697 ($906.10) + 5M x 0.000036 ($180) = $1,284.10 extra, **$1,927.50 total** — calculated from [PostHog pricing.md](https://posthog.com/pricing.md)
- Web replay bands: 5,001-15k $0.005; 15k-50k $0.0035; 50k-150k $0.002; 150k-500k $0.0017; >500k $0.0015. Math: 25k = 10k x 0.005 ($50) + 10k x 0.0035 ($35) = **$85**. 100k = $50 + 35k x 0.0035 ($122.50) + 50k x 0.002 ($100) = **$272.50** — [PostHog pricing.md](https://posthog.com/pricing.md)
- Mobile replay: 2,500 free, then $0.01 (to 15k), $0.007 (to 50k), $0.004 (to 150k) — [PostHog pricing.md](https://posthog.com/pricing.md)
- Feature flags: $0.0001/request (1-2M), $0.000045 (2-10M), $0.000025 (10-50M), $0.00001 (>50M). Surveys: $0.10 per response (1,501-2,000), $0.035 (to 10k), $0.015 (to 20k), $0.01 (>20k) — [PostHog pricing.md](https://posthog.com/pricing.md)
- Platform packages: Boost $250/mo (unlimited projects, white labelling, HIPAA BAA, SSO enforcement); Scale $750/mo (adds SAML, priority support); Enterprise $2,000/mo (adds RBAC, dedicated support) — [PostHog pricing.md](https://posthog.com/pricing.md)
- Heatmap data is free to ingest. The free plan covers 3 pages in the in-app heatmap tool; more pages and toolbar heatmaps need a card on file. Supports heatmaps, rageclicks (3 clicks within ~30px in 1s), dead clicks, scrollmaps and clickmaps (autocapture required) — [PostHog heatmaps docs](https://posthog.com/docs/toolbar/heatmaps.md)
- Third-party teardowns agree on the headline rates. One 2026 teardown says the free replay allowance fell from 15k to 5k — [DEV Community teardown](https://dev.to/beton/posthog-pricing-teardown-2026-57oo); [CostBench calculator](https://costbench.com/software/product-analytics/posthog/calculator/)

**Statsig**
- Developer (free): 2M events/mo, unlimited flag checks, 50,000 session replays/mo (30-day retention), product and web analytics with 1-year retention, A/B testing, unlimited seats — [Statsig pricing](https://www.statsig.com/pricing)
- Pro: $150/mo, 5M events included, then $0.05 per 1k events (~$50/M); 100,000 replays/mo (30-day retention); unlimited analytics retention; **one project per subscription**. Enterprise: multiple projects, SSO, RBAC, warehouse-native, HIPAA — [Statsig pricing](https://www.statsig.com/pricing)
- Math: 20M events = $150 + 15M x $50/M = **~$900/mo**. 5k/25k replays fit the free plan; 100k fits Pro — calculated from [Statsig pricing](https://www.statsig.com/pricing)

**Mixpanel**
- Free: 1M events/mo, 10k replays/mo, heatmaps, 2-year data retention, 30-day replay retention, 5 saved reports per seat, unlimited seats. Growth: first 1M free, then 5M = $613/mo monthly ($438 annual), 10M = $1,176 ($840), 20M = $2,289 ($1,635); 20k replays (up to 500k with add-ons); >20M events needs sales — [Mixpanel pricing](https://mixpanel.com/pricing/)
- Replay quotas: Free 10k, Growth/Enterprise 20k, no rollover. On Growth, once the purchased replay add-on is used up you cannot view new replays until you upgrade. Default 30-day replay retention; Enterprise add-on lets you set 7-360 days. Heatmap pageview events are exempt from event billing. No per-replay price published — [Mixpanel Session Replay docs](https://docs.mixpanel.com/docs/session-replay)
- Startup programme: first year free if the company is under 5 years old with under $8M raised — [Mixpanel pricing](https://mixpanel.com/pricing/)

**Amplitude**
- Free: 2M events/mo, 10k replays/mo (1-month retention), autocapture, unlimited flags, 1 experiment, 1 guide/survey, unlimited seats, 1-year data access, no heatmaps. Plus: "starts at $0", first 2M events free, up to 700K MTU / 70M events, 10k replays, heatmaps, 2-year data access. Growth/Enterprise: custom; 20k/50k replays; add-ons "priced as a percentage of your platform plan" — [Amplitude pricing](https://amplitude.com/pricing); [Amplitude pricing.md](https://amplitude.com/pricing.md)
- Third-party sources say Plus starts at $49/mo (annual), but one 2026 guide says $61/mo. Not confirmed on the official page — [Spendflo guide](https://www.spendflo.com/blog/amplitude-pricing-guide); [joinsecret](https://www.joinsecret.com/amplitude/pricing)

**Datadog RUM + Session Replay**
- Session Replay: $2.50 per 1k sessions/mo (annual) or $3.60 on demand, 30-day retention, works with heatmaps. Product Analytics: $0.80 per 1k sessions (annual) or $1.20 on demand, minimum 15-month retention — [Datadog pricing](https://www.datadoghq.com/pricing/?product=real-user-monitoring)
- Math (replay only, annual): 5k = $12.50, 25k = $62.50, 100k = $250. On demand: $18 / $90 / $360 — calculated from [Datadog pricing](https://www.datadoghq.com/pricing/?product=real-user-monitoring)
- RUM itself is billed separately. Third parties list RUM Measure at ~$0.15 per 1k sessions and RUM Investigate at $3.00 per 1k (annual); older Browser RUM at $1.50 per 1k is said to be retired. **Not confirmed on Datadog's page** (truncated during fetch) — [observability-pricing](https://observability-pricing.pages.dev/blog/datadog-pricing-explained-2026/); [CloudZero](https://www.cloudzero.com/blog/datadog-pricing/)

**Sentry**
- Developer free (1 user, 30-day lookback); Team $29/mo ($26 annual), Business $89/mo ($80 annual); 50 replays included; unlimited projects; unlimited users on paid plans — [Sentry pricing](https://sentry.io/pricing/)
- Per-replay rates (Team and Business): >50-5k $0.0030 reserved / $0.00375 PAYG; 5k-100k $0.00285 / $0.003563; 100k-900k $0.002565 / $0.003206 — [Sentry pricing docs](https://docs.sentry.io/pricing/)
- Math (Team PAYG, assuming graduated tiers): 5k = 4,950 x 0.00375 ($18.56) + $29 = **~$47.56**; 25k = $18.56 + 20k x 0.003563 ($71.26) + $29 = **~$118.82**; 100k = $18.56 + 95k x 0.003563 ($338.49) + $29 = **~$386.05**. Reserved is ~20% less (100k ≈ $311.60 with annual Team) — calculated from [Sentry pricing docs](https://docs.sentry.io/pricing/)

**LaunchDarkly Observability (ex-Highlight.io)**
- Developer (free) and Foundation (pay as you go): 5k session replays/mo, 5k errors, 10M logs, 10M traces included; replays stored 1 month. Overage "bills as you go" with no published rate. Developer: 1 project, 3 environments, unlimited seats, 100K experiment MAU. Foundation/Enterprise: unlimited projects — [LaunchDarkly pricing](https://launchdarkly.com/pricing/)

**Contentsquare (Hotjar's pricing now redirects here)**
- hotjar.com/pricing returns a 301 redirect to contentsquare.com/pricing — [Hotjar pricing URL](https://www.hotjar.com/pricing/)
- Experience Analytics: Free $0, up to 200k sessions, 5% replay capture (max 10k), 1-month retention, 1 project, basic surveys (3 surveys, 100 responses/mo). Growth $39/mo annual ($49 monthly), 7k-10M sessions, 15% capture (min 20k), 13-month retention, 2-month replay access, frustration score, 3 projects. Pro/Enterprise custom, up to 100% capture, Pro "up to 6" projects (FAQ says 3 + 3 purchasable; the page contradicts itself), Enterprise unlimited — [Contentsquare pricing](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
- Growth's $39 is the floor at 7k sessions. The price at 25k/100k sessions was not shown in the fetched text.

**Mouseflow**: Free 500 sessions; Essential $25 (5k); Advanced $109 (25k, 2 sites, 6-month retention); Premium $319 (100k, 5 sites, 12-month retention); unlimited seats on every plan; annual billing saves up to 35%; REST API, MCP, SSO; heatmaps, friction detection, form and journey analytics, surveys — [Mouseflow pricing](https://mouseflow.com/pricing/)

**Lucky Orange**: no free plan (7-day trial). Build $39 ($32 annual), 3.5k sessions; Grow $72 annual, 10k; Expand $249 ($199 annual), from 50k; Scale $1,049 ($839 annual), from 300k; unlimited seats; $5 per extra site; retention from 60 days (90/180/365 as upgrades) — [Lucky Orange pricing](https://www.luckyorange.com/pricing)

**Crazy Egg** (annual prices): Starter $29 (5k pageviews, 50 recordings); Plus $99 (150k pv, 1k recordings); Pro $249 (500k pv, 5k recordings); Enterprise $599 (1M pv, 10k recordings). Unlimited seats and sites; A/B tests on Plus and up; no free plan. 25k+ recordings not offered self-serve — [Crazy Egg pricing](https://www.crazyegg.com/pricing)

**LiveSession** (added): Free 1k sessions, 1-month retention, 3 seats, 2 sites; Basic $54 (5k-15k); Pro $83 from 10k (to 150k), up to 3 months retention; Enterprise from 100k. Over-limit sessions are not recorded — [LiveSession pricing](https://livesession.io/pricing)

**LogRocket**: starts at $176/mo on annual billing (calculator default 25k sessions). Core (<100k sessions) includes unlimited analytics events, replay, heatmaps, funnels, paths, surveys, SSO, API/MCP, unlimited projects. Pro (required at 100k+) adds AI features and RBAC; no published 100k price. 14-day trial, no free plan stated — [LogRocket pricing](https://logrocket.com/pricing)

**FullStory**: official Free plan with 30,000 sessions/mo, 12-month retention, up to 10 users (session replay, basic analytics). Business/Advanced/Enterprise are quote-only — [FullStory pricing](https://www.fullstory.com/pricing/). Third-party estimates conflict: Business $10k-25k/yr at 50-100k sessions/mo; Vendr median $28,245/yr — [Usercall](https://usercall.co/post/fullstory-pricing); [Vendr](https://www.vendr.com/marketplace/fullstory). Older articles put the free tier at 1,000 sessions; the official page now says 30,000.

**Heap (Contentsquare)**: Free up to 10k sessions/mo, 6-month history, 1 project, autocapture, no replay or heatmaps. Growth: price by estimate, 12 months, unlimited users. Pro (3 projects) and Premier (unlimited) are custom; replay and heatmaps are add-ons — [Heap pricing](https://www.heap.io/pricing)

**Pendo**: Free up to 500 MAU (guides, Pendo-branded NPS). Base/Core/Ultimate quote-only; replay is an add-on on Base and included on Core/Ultimate. Novus beta is free with no MAU cap — [Pendo pricing](https://www.pendo.io/pricing/)

**Userpilot**: Starter $299/mo (2k MAU, 3 seats); Growth from $849/mo (5k replays/mo, 30-day replay retention, autocapture, 15 seats); heatmaps "coming soon" — [Userpilot pricing](https://userpilot.com/pricing/)

**UXCam**: quote-only by monthly sessions; no free plan or retention listed — [UXCam pricing](https://uxcam.com/pricing)

**Usermaven**: page now quote-only (Business/Enterprise); autocapture, funnels, unlimited websites; extra workspaces are a paid add-on; replay and heatmaps not mentioned — [Usermaven pricing](https://usermaven.com/pricing)

**OpenReplay**: Open-source self-host free; Dedicated (managed) from $199/mo ($0.276/hr) with custom retention and SSO; Serverless "pay per session" with no rate published — [OpenReplay pricing](https://openreplay.com/pricing)

**Glassbox / Quantum Metric**: no public prices. Estimates: Quantum Metric ~$280k/yr average (ITQlick), GetApp says from $25k/yr; Glassbox marketplace from $50k/yr (double for web + mobile), ITQlick $230k-330k first year — [ITQlick Quantum Metric](https://www.itqlick.com/quantum-metric/pricing); [GetApp](https://www.getapp.com/business-intelligence-analytics-software/a/quantum-metric/reviews/); [Koji Glassbox alternatives](https://www.koji.so/blog/glassbox-alternatives-2026)

**Discontinued**
- **Smartlook**: end of sale for new paid plans 31 May 2026; renewals until 31 Aug 2026; free plan access until 30 Sep 2027; data is not migrated to Splunk — [Smartlook pricing](https://www.smartlook.com/pricing/)
- **June.so**: team joined Amplitude (announced 8 July 2025); standalone product wound down around 8 Aug 2025 — [June blog](https://www.june.so/blog/a-new-chapter); [LiveSession](https://livesession.io/blog/june-so-shutdown-what-happened-and-how-to-migrate-best-june-so-alternatives)

**Privacy-first web analytics (no replay or heatmaps)**
- Plausible Cloud: Starter $9 (1 site), Growth $14 (3 sites / 3 members), Business $19 (10 sites, funnels, Stats API 600 req/h), each at the lowest traffic tier; unlimited retention; Sites API on Enterprise only — [Plausible](https://plausible.io/#pricing)
- Fathom: $15 (100k pv), $60 (1M), $140 (5M), $380 (20M); 50+ sites; Analytics API on all plans; custom events count as pageviews — [Fathom pricing](https://usefathom.com/pricing)
- Simple Analytics: Free (5 sites, 30-day retention, badge required); paid from $20/mo + $20 per extra user — [Simple Analytics pricing](https://www.simpleanalytics.com/pricing)
- Matomo Cloud: from $29/mo (50k hits); tiers to 10M+ hits; 30 sites, 30 users, 24-month raw data; heatmaps, session recordings and A/B testing listed (quantities blank on page) — [Matomo pricing](https://matomo.org/pricing/)

### Inferences
- For "events at 1-20M + replays + heatmaps" in one tool with published prices, PostHog is the only cheap option with full UX features listed: autocapture, heatmaps, rage/dead clicks, scrollmaps, replay, funnels, surveys and flags/experiments. Statsig is cheaper but does not list heatmaps on its pricing page, and Pro is one project per subscription.
- At 20M identified events, PostHog (~$1,928) and Mixpanel ($1,635-2,289) cost about the same. Using anonymous events wherever possible is the main lever on PostHog cost.
- For replay-only volume, Datadog ($2.50 per 1k), Sentry (~$3 per 1k) and PostHog ($2-3.50 per 1k at 25-100k) are the cheapest metered replay. Mouseflow ($3.19 per 1k at 100k) is the cheapest flat-tier DXA tool with heatmaps.
- Pairing a cheap event tool with free Clarity for heatmaps/replay is cheaper than any single paid DXA tool.

### Gaps
- Amplitude Plus, Growth and replay add-on prices are not published; the $49 figure comes only from third parties.
- Mixpanel per-replay overage, Contentsquare Growth price at 25k/100k sessions, LogRocket 100k price and LaunchDarkly overage rates were not published.
- Datadog RUM base rates were not confirmed on the official page (the fetch was truncated).
- Statsig heatmap support and ownership changes (reported acquisitions) were not verified here.
- OpenReplay Serverless per-session price is not published.
- No G2 or Reddit thread with verified real invoices was found; FullStory and Glassbox figures are vendor-marketing or aggregator estimates.

## Is Microsoft Clarity a viable free complement (heatmaps/replay) next to a self-hosted event tool?

### Takeaway
Yes for heatmaps, replay and frustration signals: it is free with no traffic tiers, unlimited projects and unlimited members, recording up to 100k sessions per project per day. The costs are a 30-day recording retention, a token-scoped export API capped at 10 calls per project per day, no API to create projects or manage members, consent enforcement in the EEA/UK/CH, and terms that let Microsoft use the data, including for advertising profiles.

### Cited Findings
- Free forever, no traffic limits, no paid upgrade; unlimited sites/projects per account — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq) (page dated 2026-10-16)
- Records up to 100,000 sessions per project per day; heatmaps are capped at 100,000 page views each — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Recordings kept 30 days; favourites and a random sample kept up to 9 months; labels up to 9 months (max 1,000 per project) — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Per-user data cannot be deleted; you must delete the whole project — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Team: unlimited members and admins per project, 2 roles (Admin, Team member), max 10 pending invites at a time — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Masking: input boxes are masked in every mode and cannot be unmasked; URL parameter masking needs a support request; CSS is not masked — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Data stored in Azure; "Microsoft/Clarity has access to the data"; EU customers contract with Microsoft Ireland — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Consent is enforced for users in the EEA, UK and Switzerland; without consent, collection is limited. Consent must be set up per project — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq)
- Data Export API: one GET endpoint (`project-live-insights`), project-scoped JWT made by an admin in the UI, **10 requests per project per day**, last 1-3 days only, up to 3 dimensions, 1,000 rows, no pagination. Metrics include scroll depth, dead/rage/quickback clicks, excessive scroll and script errors. No endpoints for creating projects or managing users — [Clarity Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
- Terms: Microsoft may use personal data from the service to improve its products and to build user profiles, including for advertising; non-personal data may be used to improve Microsoft products — [Clarity terms](https://clarity.microsoft.com/terms) (via search summary; direct fetch returned no text). A third party notes that linking Clarity to Microsoft Advertising may count as "sale/sharing" under CPRA — [Lokker guide](https://lokker.com/privacy-policy-guide/microsoft-clarity)

### Inferences
- Clarity works as the "qualitative layer" beside a self-hosted event store. But it cannot be provisioned programmatically: each workspace's project and members must be set up by hand in the Clarity UI, and its export API is too limited to sync data back.
- If the product makes per-tenant projects automatically, Clarity breaks that flow. A single shared Clarity project (separated with custom tags, up to 128 per page) is the only automatable option.
- Advertising-profile wording in the terms and the US parent's data access may be a deal-breaker for privacy-positioned products.

### Gaps
- The exact current wording and effective date of the Clarity terms could not be fetched directly.
- There is no documented API for creating projects; that conclusion comes from the docs not mentioning one.

## Which offer multi-project + team management via API on low tiers?

### Takeaway
PostHog is the clearest: an organization invites API on any plan; 1 project free, 6 on pay-as-you-go, unlimited with Boost ($250/mo); per-project RBAC only on Enterprise ($2,000/mo). Sentry and LogRocket give unlimited projects on low tiers. Most DXA tools (Clarity, Mouseflow, Lucky Orange, Crazy Egg) give unlimited seats but manage projects and users in the UI only. Plausible's Sites API is Enterprise-only.

### Cited Findings
- PostHog: projects 1 (free) / 6 (paid) / unlimited with Boost $250/mo; SAML on Scale $750/mo; RBAC on Enterprise $2,000/mo — [PostHog pricing.md](https://posthog.com/pricing.md)
- PostHog invites API: GET/POST/DELETE `/api/organizations/:organization_id/invites` plus `/invites/bulk`; POST needs the `organization_member:write` scope; personal API key as Bearer token; up to 10 keys per account — [PostHog invites docs](https://posthog.com/docs/api/invites); [PostHog API overview](https://posthog.com/docs/api.md)
- Statsig: unlimited seats on free; Pro is one project per subscription; multiple projects and RBAC only on Enterprise — [Statsig pricing](https://www.statsig.com/pricing)
- Sentry: unlimited projects on all plans, unlimited users from Team ($26-29/mo) — [Sentry pricing](https://sentry.io/pricing/)
- LaunchDarkly Observability: Developer 1 project / 3 environments; Foundation unlimited projects, no seat fees — [LaunchDarkly pricing](https://launchdarkly.com/pricing/)
- LogRocket: unlimited projects and environments and API/MCP access on Core; RBAC on Pro — [LogRocket pricing](https://logrocket.com/pricing)
- Mixpanel and Amplitude: unlimited seats on every plan; Amplitude Free 1 space, Plus 3, Growth unlimited; Enterprise "unlimited projects per portfolio" — [Mixpanel pricing](https://mixpanel.com/pricing/); [Amplitude pricing](https://amplitude.com/pricing)
- Heap: 1 project (Free/Growth), 3 (Pro, more as add-on), unlimited (Premier); custom permissions only on Premier — [Heap pricing](https://www.heap.io/pricing)
- Contentsquare: 1 / 3 / up to 6 / unlimited projects across Free/Growth/Pro/Enterprise — [Contentsquare pricing](https://contentsquare.com/pricing/?utm_source=hotjar-pricing)
- Clarity: unlimited projects and members, UI only; API is export-only — [Clarity FAQ](https://learn.microsoft.com/en-us/clarity/faq); [Clarity Data Export API](https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api)
- Mouseflow: unlimited seats; 1/1/2/5 site projects; REST API — [Mouseflow pricing](https://mouseflow.com/pricing/)
- Lucky Orange: unlimited seats, $5 per extra site; Crazy Egg: unlimited seats and sites — [Lucky Orange pricing](https://www.luckyorange.com/pricing); [Crazy Egg pricing](https://www.crazyegg.com/pricing)
- Plausible: team management from Growth ($14); Sites API only on Enterprise. Fathom: 50+ sites and Analytics API on all plans. Matomo Cloud: 30 sites / 30 users — [Plausible](https://plausible.io/#pricing); [Fathom pricing](https://usefathom.com/pricing); [Matomo pricing](https://matomo.org/pricing/)

### Inferences
- For per-tenant provisioning on a low tier, PostHog pay-as-you-go (6 projects, invites API) works for a few tenants. Beyond 6 projects it costs $250/mo (Boost). Per-project access control costs $2,000/mo, so the cheap path is one PostHog project with tenant separation by property or group.
- Sentry/LaunchDarkly give unlimited projects cheaply but are developer-observability tools without product-analytics funnels or heatmaps.

### Gaps
- PostHog's project-creation endpoint and scopes were not confirmed (docs page fetch failed); invites are confirmed.
- Project-creation APIs for Mixpanel, Amplitude, Mouseflow, LogRocket and Fathom were not checked in this pass.
