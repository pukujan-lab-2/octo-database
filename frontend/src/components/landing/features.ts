/** The feature list behind the homepage chapters and the /features/:slug pages.
 *  One entry here is the only registration a feature needs. Every claim here is
 *  something Octo ships; the docs page named in `docs` has the detail. */

export interface Feature {
  slug: string;
  number: string;
  /** Short name for nav and cards. */
  name: string;
  /** The chapter headline. */
  headline: string;
  lead: string;
  points: string[];
  /** A real request or result, shown on the stage card. */
  sample: { label: string; lines: string[] };
  /** How it works, in three beats, for the feature page. */
  steps: { title: string; body: string }[];
  docs: string;
  /** Hue (0-360) for the chapter's tint. */
  hue: number;
}

export const FEATURES: Feature[] = [
  {
    slug: "databases",
    number: "01",
    name: "Databases",
    headline: "A real Postgres for every workspace.",
    lead: "Creating a workspace provisions its own PostgreSQL database with its own scoped role. Run SQL with an Octo key and nothing else: no host, no port, no connection string for an agent to leak.",
    points: [
      "pgvector on, row-level security on",
      "Query over HTTP, or connect with any Postgres client",
      "Nothing crosses between workspaces",
    ],
    sample: {
      label: "POST /api/workspaces/<id>/query",
      lines: [
        '{ "sql": "select count(*) from items" }',
        "",
        "→ { \"rows\": [{ \"count\": 1284 }] }",
      ],
    },
    steps: [
      { title: "Create a workspace", body: "A person creates it once, confirmed with a human code. The database and its role appear with it." },
      { title: "Mint a key", body: "A workspace-scoped key reaches only this workspace's database." },
      { title: "Run SQL", body: "Post a statement. Rows come back. The server connects as the workspace's own role." },
    ],
    docs: "/docs/sql",
    hue: 205,
  },
  {
    slug: "files",
    number: "02",
    name: "Files",
    headline: "Files that publish, archive and come back.",
    lead: "Upload to hot object storage, serve thumbnails, hand out short-lived signed links, and publish a single file to a stable public URL. Move cold files to Google Drive and restore them on demand.",
    points: [
      "Gallery for images and video",
      "Scoped public share links",
      "Publish one file, not the bucket",
    ],
    sample: {
      label: "Workspace files",
      lines: ["site-launch.mp4      hot       published", "q3-board-deck.pdf     hot", "2023-raw-footage.zip  archived  restore on demand"],
    },
    steps: [
      { title: "Upload", body: "Bytes land in Cloudflare R2. Thumbnails are made for images and video." },
      { title: "Share or publish", body: "A signed link expires. A published copy gets a stable HTTPS URL, and unpublishing reverses it." },
      { title: "Archive", body: "Move a file to Drive when it goes cold, and restore it the moment it is needed." },
    ],
    docs: "/docs/files",
    hue: 160,
  },
  {
    slug: "analytics",
    number: "03",
    name: "Analytics",
    headline: "Ask questions without handing over SQL.",
    lead: "Register immutable Parquet dataset versions, then run named query specs through DuckDB. The caller never writes the statement, so a request cannot widen the read. Save specs per workspace, append data, and schedule runs that write back.",
    points: [
      "Immutable dataset versions",
      "Saved specs and scheduled write-back",
      "Result artifacts you can fetch as rows",
    ],
    sample: {
      label: "query_dataset",
      lines: ['{ "dataset": "orders", "spec": "revenue_by_week" }', "", "→ 12 rows · result ready"],
    },
    steps: [
      { title: "Register a dataset", body: "Upload Parquet parts. Each version is immutable." },
      { title: "Name a question", body: "A spec says what to compute. The server builds the statement." },
      { title: "Fetch or schedule", body: "Read the result rows, or run the spec on a schedule and write the answer back." },
    ],
    docs: "/docs/analytics",
    hue: 38,
  },
  {
    slug: "retrieval",
    number: "04",
    name: "Retrieval",
    headline: "Search that finds the passage.",
    lead: "Ingest documents and Octo chunks and embeds them. A query runs a vector arm and a keyword arm, fuses them, and reranks the best. Filter by document, title or latest version without slowing down on a big site.",
    points: [
      "Hybrid vector plus keyword search",
      "Optional reranking",
      "Filters that use the indexes",
    ],
    sample: {
      label: "POST /api/rag/query",
      lines: ['{ "query": "why did the migration fail?",', '  "filter": { "latestVersionOnly": true } }', "", "→ 5 matches · reranked"],
    },
    steps: [
      { title: "Ingest", body: "Send text or a PDF. Readers are tried in order and the first that answers wins." },
      { title: "Embed", body: "Chunks are embedded as 512-dimension half-precision vectors." },
      { title: "Query", body: "Hybrid search, then rerank. A paraphrase and an exact term both land." },
    ],
    docs: "/docs/retrieval",
    hue: 262,
  },
  {
    slug: "ledger",
    number: "05",
    name: "Ledger and graph",
    headline: "What you knew, and when you knew it.",
    lead: "A bitemporal ledger records claims, beliefs and evidence. A correction is a new row, never a rewrite, so you can ask what was true as of any moment. A graph rebuilds from it for questions about how things connect.",
    points: [
      "As-of queries over valid and recorded time",
      "Rebuildable FalkorDB graph projection",
      "Read-only Cypher",
    ],
    sample: {
      label: "query_claims_as_of",
      lines: ['{ "asOf": "2026-09-01" }', "", "→ claim-7 supersedes claim-3", "→ evidence: 2 documents"],
    },
    steps: [
      { title: "Record", body: "Append claims with their evidence. Nothing is overwritten." },
      { title: "Ask as of a date", body: "See the belief the system held on any day." },
      { title: "Traverse", body: "Project the ledger into a graph and walk the relationships." },
    ],
    docs: "/docs/retrieval#ledger",
    hue: 14,
  },
  {
    slug: "vault",
    number: "06",
    name: "Vault",
    headline: "Spend a key without holding it.",
    lead: "Store a vendor credential once. An agent gets a temporary key, and the relay adds the real one to the outbound request. The model never sees the secret, and you can revoke the lease at any moment.",
    points: [
      "Leases instead of secrets",
      "Relay to vendor APIs",
      "A .env pulled from the vault on demand",
    ],
    sample: {
      label: "Vault lease",
      lines: ["OPENAI_API_KEY   stored", "lease  octo_tmp_4f…   expires in 1h", "agent used it 14 times"],
    },
    steps: [
      { title: "Store", body: "A person adds the credential. It is encrypted and never returned." },
      { title: "Lease", body: "An agent asks for a working key that expires." },
      { title: "Relay", body: "Octo injects the real credential into the call and returns only the vendor's answer." },
    ],
    docs: "/docs/vault",
    hue: 120,
  },
  {
    slug: "observability",
    number: "07",
    name: "Traces and UX analytics",
    headline: "See what your agents and your users do.",
    lead: "Send OTLP traces and eval scores with your Octo key and they land in Phoenix, one project per workspace. Turn on UX analytics and get a Umami website for clicks, replays and heatmaps. Agents can read both back.",
    points: [
      "One Phoenix project per workspace",
      "A Umami website with your members on its team",
      "Every key use logged, with alerts",
    ],
    sample: {
      label: "POST …/otel/v1/traces",
      lines: ["OTLP/HTTP, forwarded unchanged", "", "→ project: your-workspace", "→ first span creates it"],
    },
    steps: [
      { title: "Send", body: "Point your OTLP exporter at the workspace route with your key." },
      { title: "Look", body: "Open Phoenix or Umami from the dashboard, already signed in." },
      { title: "Let agents read", body: "Traces and site stats come back through the same key and the MCP tools." },
    ],
    docs: "/docs/observability",
    hue: 190,
  },
  {
    slug: "agents",
    number: "08",
    name: "Built for agents",
    headline: "One surface for people and agents.",
    lead: "Forty tools on a Streamable HTTP MCP server, listing only what the calling key can use, with a guide tool for recipes. Keys carry four scopes. Creating or deleting a workspace, minting a key, or widening a key stops at a confirmation code a human holds.",
    points: [
      "40 MCP tools, OAuth 2.1 for hosted clients",
      "Live capability discovery per key",
      "Human confirmation for the dangerous steps",
    ],
    sample: {
      label: "GET /api/capabilities",
      lines: ["→ the actions this key may call", "→ the ones this server cannot serve", "→ how to authenticate"],
    },
    steps: [
      { title: "Connect", body: "Point an MCP client at /mcp with a bearer key, or authorize over OAuth." },
      { title: "Discover", body: "Ask what the key can do. The list is exact, not documentation that drifts." },
      { title: "Work", body: "Query, upload, retrieve and record. Destructive steps wait for a human." },
    ],
    docs: "/docs/mcp",
    hue: 300,
  },
];

export function findFeature(slug: string | undefined): Feature | undefined {
  return FEATURES.find((feature) => feature.slug === slug);
}
