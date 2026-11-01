/**
 * Playwright E2E: metamorphic relations for search and the graph (#419).
 *
 * Each test changes something that should not matter, or should only remove
 * results, and checks the output moved exactly as promised.
 *
 *   MR-S1  Another workspace's documents do not change a workspace's search
 *          results: same chunks, same order, same scores, even when the other
 *          workspace's text and vectors match the query better.
 *   MR-S2  A filter only removes. Filtering by documents or title prefix returns
 *          a subset of the unfiltered matches, and every match passes the filter.
 *   MR-G1  Projecting twice gives the same graph, node for node and edge for edge.
 *   MR-G2  Recording into and projecting another workspace leaves this
 *          workspace's graph unchanged.
 *
 * Search runs the SQL function POST /api/rag/query calls, with fixtures seeded
 * directly, because CI has no embedding provider (as rag-hybrid-retrieval.spec.ts
 * does). Reranking's "only reorders" relation is a unit test:
 * tests/unit/rerank-metamorphic.test.ts. The graph half needs FalkorDB and is
 * skipped where none is configured.
 */

import { expect, test, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { CONFIRM_SECRET, setConfirmSecret } from './confirm-secret';
import { queryService } from '../../src/server/db';

// Search

/** Workspaces this spec seeded, removed afterwards so a shared instance stays clean. */
const seeded: Array<{ workspaceId: string; principalId: string }> = [];

test.afterAll(async () => {
  if (seeded.length === 0) return;
  // workspaces.created_by is ON DELETE RESTRICT, so workspaces go first.
  await queryService(`DELETE FROM octo.workspaces WHERE id = ANY($1)`, [seeded.map((s) => s.workspaceId)]);
  await queryService(`DELETE FROM octo.principals WHERE id = ANY($1)`, [seeded.map((s) => s.principalId)]);
});

/** A 512-dimension one-hot vector. */
function oneHot(axis: number): string {
  return `[${Array.from({ length: 512 }, (_, i) => (i + 1 === axis ? '1' : '0')).join(',')}]`;
}

interface Workspace {
  workspaceId: string;
  principalId: string;
  configId: string;
}

async function seedWorkspace(): Promise<Workspace> {
  const principal = await queryService<{ id: string }>(
    `INSERT INTO octo.principals (auth_user_id, email, display_name)
     VALUES (gen_random_uuid(), $1, 'Metamorphic E2E') RETURNING id`,
    [`metamorphic-${randomUUID()}@example.invalid`]
  );
  const principalId = principal[0]!.id;
  const workspace = await queryService<{ id: string }>(
    `INSERT INTO octo.workspaces (slug, name, created_by) VALUES ($1, 'Metamorphic E2E', $2) RETURNING id`,
    [`metamorphic-${randomUUID()}`, principalId]
  );
  const workspaceId = workspace[0]!.id;
  const config = await queryService<{ id: string }>(
    `INSERT INTO octo.embedding_configs
       (workspace_id, model, model_version, dimensions, chunker, chunk_size, chunk_overlap)
     VALUES ($1, 'metamorphic-e2e', 'v1', 512, 'paragraph-aware', 800, 100) RETURNING id`,
    [workspaceId]
  );
  seeded.push({ workspaceId, principalId });
  return { workspaceId, principalId, configId: config[0]!.id };
}

/** Seeds one document with a single chunk whose embedding lies on `axis`. */
async function seedDocument(ws: Workspace, title: string, content: string, axis: number): Promise<string> {
  const doc = await queryService<{ id: string }>(
    `INSERT INTO octo.documents (workspace_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [ws.workspaceId, title, ws.principalId]
  );
  const documentId = doc[0]!.id;
  const version = await queryService<{ id: string }>(
    `INSERT INTO octo.document_versions
       (document_id, workspace_id, version_number, content_hash, mime_type, byte_size, extracted_text, extraction_status)
     VALUES ($1, $2, 1, $3, 'text/plain', $4, $5, 'extracted') RETURNING id`,
    [documentId, ws.workspaceId, `sha256:${randomUUID()}`, content.length, content]
  );
  const chunk = await queryService<{ id: string }>(
    `INSERT INTO octo.chunks
       (workspace_id, document_version_id, config_id, chunk_index, chunk_key, content, start_offset, end_offset, token_estimate)
     VALUES ($1, $2, $3, 0, $4, $5, 0, $6, 10) RETURNING id`,
    [ws.workspaceId, version[0]!.id, ws.configId, `key-${randomUUID()}`, content, content.length]
  );
  await queryService(
    `INSERT INTO octo.embeddings (workspace_id, chunk_id, config_id, embedding) VALUES ($1, $2, $3, $4::halfvec)`,
    [ws.workspaceId, chunk[0]!.id, ws.configId, oneHot(axis)]
  );
  return documentId;
}

interface Match {
  chunkId: string;
  documentId: string;
  title: string;
  similarity: number | null;
  lexicalScore: number | null;
  score: number;
}

/** Calls the same function POST /api/rag/query calls, with its optional filter. */
function search(
  ws: Workspace,
  text: string,
  axis: number,
  limit: number,
  filter: { documentIds?: string[]; titlePrefix?: string } = {}
): Promise<Match[]> {
  return queryService<Match>(
    `SELECT chunk_id AS "chunkId", document_id AS "documentId", title, similarity,
            lexical_score AS "lexicalScore", score
     FROM octo.match_chunks_hybrid($1, $2::halfvec, $3, $4, $5::uuid[], $6, false)`,
    [ws.workspaceId, oneHot(axis), text, limit, filter.documentIds ?? null, filter.titlePrefix ?? null]
  );
}

const CORPUS: Array<[title: string, content: string, axis: number]> = [
  ['finance/invoices', 'Invoice reconciliation runs nightly against the ledger.', 3],
  ['finance/payroll', 'Payroll closes on the 25th; invoices are not involved.', 4],
  ['ops/runbook', 'Restart the reconciliation worker if the queue stalls.', 3],
  ['ops/oncall', 'The on-call rota rotates weekly.', 7],
  ['legal/contracts', 'Contracts reference invoice terms of 30 days.', 9],
  ['legal/privacy', 'Personal data is kept for 90 days.', 3],
];

const QUERIES: Array<[text: string, axis: number]> = [
  ['invoice reconciliation', 3],
  ['queue stalls', 7],
  ['the', 9],
  ['privacy data retention', 1],
];

test.describe('Search metamorphic relations', () => {
  test("MR-S1: another workspace's documents do not change the results", async () => {
    const mine = await seedWorkspace();
    for (const [title, content, axis] of CORPUS) await seedDocument(mine, title, content, axis);

    const before = await Promise.all(QUERIES.map(([text, axis]) => search(mine, text, axis, 5)));

    // The other workspace's documents match every query better: they repeat the
    // query words and sit exactly on the query axis.
    const other = await seedWorkspace();
    for (const [text, axis] of QUERIES) {
      for (let i = 0; i < 4; i += 1) await seedDocument(other, `${text} ${i}`, `${text} ${text} ${text}`, axis);
    }

    const after = await Promise.all(QUERIES.map(([text, axis]) => search(mine, text, axis, 5)));
    expect(after).toEqual(before);
    for (const matches of after) expect(matches.length).toBeGreaterThan(0);
  });

  test('MR-S2: a filter only removes matches', async () => {
    const ws = await seedWorkspace();
    const ids = new Map<string, string>();
    for (const [title, content, axis] of CORPUS) ids.set(title, await seedDocument(ws, title, content, axis));

    for (const [text, axis] of QUERIES) {
      const all = await search(ws, text, axis, 50);
      const allIds = new Set(all.map((m) => m.chunkId));

      const chosen = [ids.get('finance/invoices')!, ids.get('ops/oncall')!, ids.get('legal/privacy')!];
      const byDocument = await search(ws, text, axis, 50, { documentIds: chosen });
      for (const match of byDocument) {
        expect(allIds.has(match.chunkId)).toBe(true);
        expect(chosen).toContain(match.documentId);
      }

      const byTitle = await search(ws, text, axis, 50, { titlePrefix: 'legal/' });
      for (const match of byTitle) {
        expect(allIds.has(match.chunkId)).toBe(true);
        expect(match.title.startsWith('legal/')).toBe(true);
      }
      // Every legal document is still reachable by vector, so the filter returns
      // all of them rather than an empty list.
      expect(byTitle.length).toBe(2);
    }
  });
});

// Graph

interface GuestSession {
  workspace: { id: string };
  sessionToken: string;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

async function writerFor(request: APIRequestContext): Promise<{ workspaceId: string; token: string }> {
  const guest = await request.post('/api/auth/guest', { data: { displayName: `Graph MR ${randomUUID()}` } });
  expect(guest.status()).toBe(201);
  const session = (await guest.json()) as GuestSession;
  await setConfirmSecret(request, session.sessionToken);
  const key = await request.post('/api/keys', {
    headers: bearer(session.sessionToken),
    data: { name: 'graph mr', workspaceId: session.workspace.id, scopes: ['read', 'write'], confirmSecret: CONFIRM_SECRET },
  });
  expect(key.status()).toBe(201);
  return { workspaceId: session.workspace.id, token: ((await key.json()) as { rawSecret: string }).rawSecret };
}

async function record(request: APIRequestContext, token: string, body: Record<string, unknown>) {
  const response = await request.post('/api/epistemic/record', { headers: bearer(token), data: body });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as Record<string, { id: string }>;
}

/** Records a small ledger: two entities, a perspective, claims with a relation, evidence and a belief. */
async function recordLedger(request: APIRequestContext, token: string, workspaceId: string, tag: string) {
  const at = { validFrom: '2026-06-01T00:00:00Z', recordedAt: '2026-06-01T00:00:00Z' };
  const city = await record(request, token, { workspaceId, kind: 'entity', name: `City ${tag}`, entityType: 'place' });
  const agency = await record(request, token, { workspaceId, kind: 'entity', name: `Agency ${tag}` });
  const analyst = await record(request, token, { workspaceId, kind: 'perspective', name: `Analyst ${tag}` });
  const first = await record(request, token, {
    workspaceId, kind: 'claim', subjectEntityId: city['entity']!.id, statement: `Ridership in ${tag} rose 12%.`, ...at,
  });
  const second = await record(request, token, {
    workspaceId, kind: 'claim', subjectEntityId: agency['entity']!.id, statement: `The agency in ${tag} added routes.`, ...at,
  });
  await record(request, token, {
    workspaceId, kind: 'claim_relation', fromClaimId: second['claim']!.id, toClaimId: first['claim']!.id, relation: 'SUPPORTS', ...at,
  });
  await record(request, token, {
    workspaceId, kind: 'belief', perspectiveId: analyst['perspective']!.id, claimId: first['claim']!.id,
    stance: 'believes', confidence: 0.8, ...at,
  });
}

/** Every node and edge of the workspace graph, in a stable order. */
async function snapshot(request: APIRequestContext, token: string, workspaceId: string) {
  const read = async (cypher: string) => {
    const response = await request.post('/api/graph/query', { headers: bearer(token), data: { workspaceId, query: cypher } });
    expect(response.status(), await response.text()).toBe(200);
    const rows = ((await response.json()) as { rows: unknown[] }).rows;
    return rows.map((row) => JSON.stringify(row)).sort();
  };
  return {
    nodes: await read('MATCH (n) RETURN labels(n) AS labels, properties(n) AS props'),
    edges: await read('MATCH (a)-[r]->(b) RETURN type(r) AS type, properties(r) AS props, a.id AS source, b.id AS target'),
  };
}

const project = (request: APIRequestContext, token: string, workspaceId: string) =>
  request.post('/api/graph/project', { headers: bearer(token), data: { workspaceId } });

test.describe('Graph metamorphic relations', () => {
  test('MR-G1 and MR-G2: projection is repeatable and ignores other workspaces', async ({ request }) => {
    const mine = await writerFor(request);
    const probe = await project(request, mine.token, mine.workspaceId);
    test.skip(probe.status() === 503, 'A FalkorDB engine is required for the graph relations');
    expect(probe.status()).toBe(200);

    await recordLedger(request, mine.token, mine.workspaceId, 'north');
    expect((await project(request, mine.token, mine.workspaceId)).status()).toBe(200);
    const first = await snapshot(request, mine.token, mine.workspaceId);
    expect(first.nodes.length).toBeGreaterThan(0);
    expect(first.edges.length).toBeGreaterThan(0);

    // MR-G1
    expect((await project(request, mine.token, mine.workspaceId)).status()).toBe(200);
    expect(await snapshot(request, mine.token, mine.workspaceId)).toEqual(first);

    // MR-G2: the other workspace uses the same names, so a projection that ignored
    // the workspace would visibly merge into this graph.
    const other = await writerFor(request);
    await recordLedger(request, other.token, other.workspaceId, 'north');
    expect((await project(request, other.token, other.workspaceId)).status()).toBe(200);
    expect(await snapshot(request, mine.token, mine.workspaceId)).toEqual(first);
    expect((await project(request, mine.token, mine.workspaceId)).status()).toBe(200);
    expect(await snapshot(request, mine.token, mine.workspaceId)).toEqual(first);
  });
});
