/**
 * The graph step of search (issue #42).
 *
 * A query that sends `graph` takes the documents behind its best hybrid matches as
 * seeds, follows the workspace's document links from them (octo.match_linked_chunks)
 * and merges the linked documents' best passages into the hybrid list by RRF, before
 * the rerank. It finds documents that share neither words nor meaning with the
 * question but are linked to ones that do, such as a case the matching cases cite.
 *
 *   graph: true                                      defaults below
 *   graph: { relations?: string[], seeds?: 1-20, hops?: 1|2 }
 */

export interface GraphOptions {
  relations?: string[];
  seeds: number;
  hops: 1 | 2;
}

export const GRAPH_DEFAULT_SEEDS = 5;
export const RELATION_RE = /^[a-z][a-z0-9_]{0,39}$/;

/** Parses the request's `graph` field: null when absent or false, a string when invalid. */
export function parseGraphOption(value: unknown): GraphOptions | null | string {
  if (value === undefined || value === false) return null;
  if (value === true) return { seeds: GRAPH_DEFAULT_SEEDS, hops: 1 };
  const invalid = 'graph must be true or { relations?: string[], seeds?: 1-20, hops?: 1 | 2 }';
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return invalid;
  const { relations, seeds, hops } = value as Record<string, unknown>;
  if (relations !== undefined && (!Array.isArray(relations) || !relations.every((r) => typeof r === 'string' && RELATION_RE.test(r)))) {
    return invalid;
  }
  if (seeds !== undefined && !(Number.isInteger(seeds) && (seeds as number) >= 1 && (seeds as number) <= 20)) return invalid;
  if (hops !== undefined && hops !== 1 && hops !== 2) return invalid;
  return {
    ...(relations !== undefined ? { relations: relations as string[] } : {}),
    seeds: (seeds as number | undefined) ?? GRAPH_DEFAULT_SEEDS,
    hops: (hops as 1 | 2 | undefined) ?? 1,
  };
}

/** The distinct documents behind the best matches, best first, at most `count`. */
export function seedDocuments(matches: Array<{ documentId: string }>, count: number): string[] {
  const seeds: string[] = [];
  for (const match of matches) {
    if (seeds.length >= count) break;
    if (!seeds.includes(match.documentId)) seeds.push(match.documentId);
  }
  return seeds;
}

export interface GraphHit {
  rank: number;
  links: number;
  linkedFrom: string[];
}

/**
 * Merges the linked passages into the hybrid list. A passage's score is its hybrid
 * RRF score (0 when only the graph found it) plus 1 / (60 + its rank in the linked
 * list), the same k the hybrid fusion uses. Matches the graph found carry `graph`.
 */
export function fuseGraphMatches<H extends { chunkId: string; score: number; lexicalScore: number | null }>(
  hybrid: H[],
  linked: Array<Omit<H, 'score' | 'lexicalScore'> & { links: number; linkedFrom: string[] }>
): Array<H & { graph?: GraphHit }> {
  const fused = new Map<string, H & { graph?: GraphHit }>();
  for (const match of hybrid) fused.set(match.chunkId, { ...match });
  linked.forEach((match, i) => {
    const graph: GraphHit = { rank: i + 1, links: match.links, linkedFrom: match.linkedFrom };
    const bonus = 1 / (60 + i + 1);
    const existing = fused.get(match.chunkId);
    if (existing) {
      fused.set(match.chunkId, { ...existing, score: existing.score + bonus, graph });
    } else {
      const { links: _links, linkedFrom: _linkedFrom, ...rest } = match;
      fused.set(match.chunkId, { ...rest, lexicalScore: null, score: bonus, graph } as unknown as H & { graph: GraphHit });
    }
  });
  return Array.from(fused.values()).sort((a, b) => b.score - a.score || (a.chunkId < b.chunkId ? -1 : a.chunkId > b.chunkId ? 1 : 0));
}
