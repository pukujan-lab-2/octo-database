/**
 * Playwright E2E: the graph step of search (#42).
 *
 * Runs octo.match_linked_chunks, the function POST /api/rag/query calls with
 * `graph`, on fixtures seeded directly, because CI has no embedding provider (as
 * rag-graph-metamorphic.spec.ts does). The fusion with the hybrid list is a unit
 * test: tests/unit/rag-graph.test.ts.
 */

import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { queryService } from '../../src/server/db';

const seeded: Array<{ workspaceId: string; principalId: string }> = [];

test.afterAll(async () => {
  if (seeded.length === 0) return;
  // workspaces.created_by is ON DELETE RESTRICT, so workspaces go first.
  await queryService(`DELETE FROM octo.workspaces WHERE id = ANY($1)`, [seeded.map((s) => s.workspaceId)]);
  await queryService(`DELETE FROM octo.principals WHERE id = ANY($1)`, [seeded.map((s) => s.principalId)]);
});

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
     VALUES (gen_random_uuid(), $1, 'Graph step E2E') RETURNING id`,
    [`graph-step-${randomUUID()}@example.invalid`]
  );
  const principalId = principal[0]!.id;
  const workspace = await queryService<{ id: string }>(
    `INSERT INTO octo.workspaces (slug, name, created_by) VALUES ($1, 'Graph step E2E', $2) RETURNING id`,
    [`graph-step-${randomUUID()}`, principalId]
  );
  const workspaceId = workspace[0]!.id;
  const config = await queryService<{ id: string }>(
    `INSERT INTO octo.embedding_configs
       (workspace_id, model, model_version, dimensions, chunker, chunk_size, chunk_overlap)
     VALUES ($1, 'graph-step-e2e', 'v1', 512, 'paragraph-aware', 800, 100) RETURNING id`,
    [workspaceId]
  );
  seeded.push({ workspaceId, principalId });
  return { workspaceId, principalId, configId: config[0]!.id };
}

/** One document whose chunks lie on the given axes, one chunk per axis. */
async function seedDocument(ws: Workspace, title: string, axes: number[]): Promise<string> {
  const doc = await queryService<{ id: string }>(
    `INSERT INTO octo.documents (workspace_id, title, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [ws.workspaceId, title, ws.principalId]
  );
  const documentId = doc[0]!.id;
  const version = await queryService<{ id: string }>(
    `INSERT INTO octo.document_versions
       (document_id, workspace_id, version_number, content_hash, mime_type, byte_size, extracted_text, extraction_status)
     VALUES ($1, $2, 1, $3, 'text/plain', 10, $4, 'extracted') RETURNING id`,
    [documentId, ws.workspaceId, `sha256:${randomUUID()}`, title]
  );
  for (let i = 0; i < axes.length; i++) {
    const chunk = await queryService<{ id: string }>(
      `INSERT INTO octo.chunks
         (workspace_id, document_version_id, config_id, chunk_index, chunk_key, content, start_offset, end_offset, token_estimate)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 10, 10) RETURNING id`,
      [ws.workspaceId, version[0]!.id, ws.configId, i, `key-${randomUUID()}`, `${title} part ${i}`]
    );
    await queryService(
      `INSERT INTO octo.embeddings (workspace_id, chunk_id, config_id, embedding) VALUES ($1, $2, $3, $4::halfvec)`,
      [ws.workspaceId, chunk[0]!.id, ws.configId, oneHot(axes[i]!)]
    );
  }
  return documentId;
}

function link(ws: Workspace, from: string, to: string, relation: string): Promise<unknown> {
  return queryService(
    `INSERT INTO octo.document_links (workspace_id, from_document_id, to_document_id, relation) VALUES ($1, $2, $3, $4)`,
    [ws.workspaceId, from, to, relation]
  );
}

interface Linked {
  documentId: string;
  content: string;
  links: number;
  linkedFrom: string[];
}

function linked(
  ws: Workspace,
  axis: number,
  seeds: string[],
  options: { relations?: string[]; hops?: number; documentIds?: string[] } = {}
): Promise<Linked[]> {
  return queryService<Linked>(
    `SELECT document_id AS "documentId", content, links, linked_from AS "linkedFrom"
     FROM octo.match_linked_chunks($1, $2::halfvec, $3::uuid[], $4::text[], $5, 10, $6::uuid[], NULL, false)`,
    [ws.workspaceId, oneHot(axis), seeds, options.relations ?? null, options.hops ?? 1, options.documentIds ?? null]
  );
}

test.describe('graph step of search', () => {
  test('returns the best passage of each linked document, most-linked first, in either direction', async () => {
    const ws = await seedWorkspace();
    const seedA = await seedDocument(ws, 'Seed A', [1]);
    const seedB = await seedDocument(ws, 'Seed B', [2]);
    // Shares no axis with the query, so hybrid search would rank it last.
    const cited = await seedDocument(ws, 'Cited', [7, 1]);
    const citing = await seedDocument(ws, 'Citing', [8]);
    await seedDocument(ws, 'Unlinked', [1]);
    await link(ws, seedA, cited, 'cites');
    await link(ws, seedB, cited, 'cites');
    await link(ws, citing, seedA, 'cites');

    const rows = await linked(ws, 1, [seedA, seedB]);
    expect(rows.map((r) => r.documentId)).toEqual([cited, citing]);
    expect(rows[0]!.links).toBe(2);
    expect(rows[0]!.linkedFrom.sort()).toEqual([seedA, seedB].sort());
    // The passage of Cited closest to the query, not its first one.
    expect(rows[0]!.content).toBe('Cited part 1');
    expect(rows[1]!.linkedFrom).toEqual([seedA]);
  });

  test('follows only the asked relations, and a second hop only when asked', async () => {
    const ws = await seedWorkspace();
    const seed = await seedDocument(ws, 'Seed', [1]);
    const spec = await seedDocument(ws, 'Spec', [3]);
    const old = await seedDocument(ws, 'Old', [4]);
    const far = await seedDocument(ws, 'Far', [5]);
    await link(ws, seed, spec, 'depends_on');
    await link(ws, seed, old, 'supersedes');
    await link(ws, spec, far, 'cites');

    expect((await linked(ws, 1, [seed], { relations: ['depends_on'] })).map((r) => r.documentId)).toEqual([spec]);
    expect((await linked(ws, 1, [seed])).map((r) => r.documentId).sort()).toEqual([spec, old].sort());
    const twoHops = await linked(ws, 1, [seed], { hops: 2 });
    expect(twoHops.map((r) => r.documentId).sort()).toEqual([spec, old, far].sort());
    expect(twoHops.find((r) => r.documentId === far)!.linkedFrom).toEqual([seed]);
    // The filter applies to linked documents as it does to hybrid matches.
    expect((await linked(ws, 1, [seed], { documentIds: [old] })).map((r) => r.documentId)).toEqual([old]);
  });

  test('a link cannot cross workspaces or point at itself, and goes with its document', async () => {
    const ws = await seedWorkspace();
    const other = await seedWorkspace();
    const a = await seedDocument(ws, 'A', [1]);
    const b = await seedDocument(ws, 'B', [2]);
    const foreign = await seedDocument(other, 'Foreign', [1]);

    await expect(link(ws, a, foreign, 'cites')).rejects.toMatchObject({ code: '23503' });
    await expect(link(other, foreign, a, 'cites')).rejects.toMatchObject({ code: '23503' });
    await expect(link(ws, a, a, 'cites')).rejects.toMatchObject({ code: '23514' });
    await expect(link(ws, a, b, 'Not A Word')).rejects.toMatchObject({ code: '23514' });

    await link(ws, a, b, 'cites');
    // Another workspace's seeds reach nothing here.
    expect(await linked(other, 1, [a])).toEqual([]);
    await queryService(`DELETE FROM octo.documents WHERE id = $1`, [b]);
    expect(await queryService(`SELECT 1 FROM octo.document_links WHERE workspace_id = $1`, [ws.workspaceId])).toEqual([]);
  });
});
