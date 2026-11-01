/**
 * Metamorphic tests for reranking (#419).
 *
 * POST /api/rag/query fetches a wider hybrid candidate set, filters already
 * applied, then reranks it and cuts to the limit. These relations make sure the
 * rerank step can only reorder what search found:
 *
 *   MR-R1  The reranked list is a reordering of the candidates: nothing added,
 *          nothing dropped, nothing changed apart from `rerankScore`.
 *   MR-R2  It is ordered by rerank score; equal scores keep the hybrid order.
 *   MR-R3  Cutting to the limit after reranking keeps the top `limit` candidates,
 *          and the candidate set is never smaller than the limit asked for.
 *   MR-R4  A rerank server that answers out of order, or for only some
 *          documents, still lines each score up with its own document; missing
 *          ones sort last.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyRerankScores, rerankCandidateCount, rerankScores } from '../../src/rag/rerank';

/** Deterministic PRNG so a failing case reproduces from the seed alone. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candidate {
  chunkId: string;
  documentId: string;
  score: number;
}

function candidates(random: () => number, count: number): Candidate[] {
  return Array.from({ length: count }, (_, i) => ({
    chunkId: `chunk-${i}`,
    documentId: `doc-${Math.floor(random() * 5)}`,
    score: 1 / (60 + i),
  }));
}

// Coarse scores so ties happen often enough to test stability.
const scoresFor = (random: () => number, count: number) =>
  Array.from({ length: count }, () => Math.round(random() * 4) / 4);

describe('rerank only reorders', () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    it(`seed ${seed}`, () => {
      const random = makeRandom(seed);
      const limit = 1 + Math.floor(random() * 25);
      const pool = candidates(random, Math.floor(random() * rerankCandidateCount(limit) + 1));
      const scores = scoresFor(random, pool.length);

      const reranked = applyRerankScores(pool, scores);

      // MR-R1
      expect(reranked).toHaveLength(pool.length);
      expect(new Set(reranked.map((r) => r.chunkId))).toEqual(new Set(pool.map((c) => c.chunkId)));
      for (const result of reranked) {
        const { rerankScore, ...rest } = result;
        const original = pool.find((c) => c.chunkId === rest.chunkId)!;
        expect(rest).toEqual(original);
        expect(rerankScore).toBe(scores[pool.indexOf(original)]);
      }

      // MR-R2
      for (let i = 1; i < reranked.length; i += 1) {
        const before = reranked[i - 1]!;
        const after = reranked[i]!;
        expect(before.rerankScore).toBeGreaterThanOrEqual(after.rerankScore);
        if (before.rerankScore === after.rerankScore) {
          expect(pool.findIndex((c) => c.chunkId === before.chunkId)).toBeLessThan(
            pool.findIndex((c) => c.chunkId === after.chunkId)
          );
        }
      }

      // MR-R3
      expect(rerankCandidateCount(limit)).toBeGreaterThanOrEqual(Math.min(limit, 50));
      const cut = reranked.slice(0, limit);
      const kept = new Set(cut.map((r) => r.chunkId));
      const lowestKept = Math.min(...cut.map((r) => r.rerankScore));
      for (const dropped of reranked.filter((r) => !kept.has(r.chunkId))) {
        expect(dropped.rerankScore).toBeLessThanOrEqual(lowestKept);
      }
    });
  }
});

describe('rerank scores line up with their documents', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('MR-R4: shuffled and partial answers map back by index', async () => {
    const random = makeRandom(4190);
    for (let round = 0; round < 50; round += 1) {
      const documents = Array.from({ length: 1 + Math.floor(random() * 20) }, (_, i) => `document ${i}`);
      const truth = documents.map(() => random());
      const answered = documents
        .map((_, index) => ({ index, relevance_score: truth[index]! }))
        .filter(() => random() > 0.2)
        .sort(() => random() - 0.5);
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) =>
          url.endsWith('/models') ? new Response('{}') : new Response(JSON.stringify({ results: answered }))
        )
      );

      const scores = await rerankScores({ baseUrls: ['http://rerank.test/v1'], model: 'm' }, 'q', documents);
      const answeredIndexes = new Set(answered.map((a) => a.index));
      expect(scores).toHaveLength(documents.length);
      scores!.forEach((score, index) => {
        expect(score).toBe(answeredIndexes.has(index) ? truth[index] : Number.NEGATIVE_INFINITY);
      });
    }
  });
});
