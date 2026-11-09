import { describe, expect, it } from 'vitest';
import { fuseGraphMatches, parseGraphOption, seedDocuments } from '../../src/rag/graph';

const hit = (chunkId: string, documentId: string, score: number) => ({ chunkId, documentId, score, lexicalScore: 0.1, content: chunkId });
const linkedHit = (chunkId: string, documentId: string, links = 1) => ({ chunkId, documentId, content: chunkId, links, linkedFrom: ['seed'] });

describe('graph option', () => {
  it('is off when absent or false and takes defaults from true', () => {
    expect(parseGraphOption(undefined)).toBeNull();
    expect(parseGraphOption(false)).toBeNull();
    expect(parseGraphOption(true)).toEqual({ seeds: 5, hops: 1 });
    expect(parseGraphOption({ relations: ['cites'], seeds: 3, hops: 2 })).toEqual({ relations: ['cites'], seeds: 3, hops: 2 });
  });

  it('refuses anything else with a message', () => {
    for (const bad of ['yes', 1, [], { hops: 3 }, { seeds: 0 }, { seeds: 21 }, { relations: ['Cites'] }, { relations: 'cites' }]) {
      expect(typeof parseGraphOption(bad)).toBe('string');
    }
  });
});

describe('graph fusion', () => {
  it('seeds from the distinct documents of the best matches', () => {
    expect(seedDocuments([hit('c1', 'd1', 1), hit('c2', 'd1', 1), hit('c3', 'd2', 1), hit('c4', 'd3', 1)], 2)).toEqual(['d1', 'd2']);
  });

  it('adds a graph-only passage with only its graph term, and boosts one both lists found', () => {
    const fused = fuseGraphMatches([hit('a', 'd1', 1 / 61), hit('b', 'd2', 1 / 62)], [linkedHit('x', 'd9', 2), linkedHit('b', 'd2')]);
    expect(fused.map((m) => m.chunkId)).toEqual(['b', 'a', 'x']);
    expect(fused[0]!.score).toBeCloseTo(1 / 62 + 1 / 62);
    expect(fused[0]!.graph).toEqual({ rank: 2, links: 1, linkedFrom: ['seed'] });
    expect(fused[1]!.graph).toBeUndefined();
    expect(fused[2]).toMatchObject({ score: 1 / 61, lexicalScore: null, graph: { rank: 1, links: 2 } });
    expect(fused[2]).not.toHaveProperty('links');
  });

  it('leaves the hybrid list as it was when nothing is linked', () => {
    const hybrid = [hit('a', 'd1', 0.03), hit('b', 'd2', 0.02)];
    expect(fuseGraphMatches(hybrid, [])).toEqual(hybrid);
  });
});
