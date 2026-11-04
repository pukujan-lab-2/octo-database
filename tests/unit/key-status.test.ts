import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  grantStatus,
  groupRows,
  leaseStatus,
  relativeTime,
} from '../../frontend/src/lib/key-status';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const future = '2026-11-06T12:00:00Z';
const past = '2026-11-01T12:00:00Z';

describe('key status', () => {
  it('calls a lease revoked before expired before live', () => {
    expect(leaseStatus({ revokedAt: past, expiresAt: future }, NOW)).toBe('revoked');
    expect(leaseStatus({ revokedAt: null, expiresAt: past }, NOW)).toBe('expired');
    expect(leaseStatus({ revokedAt: null, expiresAt: future }, NOW)).toBe('live');
  });

  it('calls a tripped grant tripped even when it is still in date', () => {
    expect(grantStatus({ trippedAt: past, expiresAt: future }, NOW)).toBe('tripped');
    expect(grantStatus({ trippedAt: null, expiresAt: past }, NOW)).toBe('expired');
    expect(grantStatus({ trippedAt: null, expiresAt: future }, NOW)).toBe('live');
  });

  it('counts every status, including the empty ones', () => {
    const rows = [
      { revokedAt: null, expiresAt: future },
      { revokedAt: past, expiresAt: future },
      { revokedAt: past, expiresAt: past },
    ];
    expect(countByStatus(rows, ['live', 'expired', 'revoked'] as const, (row) => leaseStatus(row, NOW))).toEqual({
      live: 1,
      expired: 0,
      revoked: 2,
    });
  });
});

describe('groupRows', () => {
  const rows = [
    { item: 'codebuddy', live: false, at: 1 },
    { item: 'QWEN', live: true, at: 1 },
    { item: 'codebuddy', live: true, at: 2 },
    { item: 'alpha', live: false, at: 1 },
  ];
  const groups = groupRows(rows, (r) => r.item, (r) => r.live, (a, b) => b.at - a.at);

  it('puts groups with a live row first, then by name', () => {
    expect(groups.map((g) => g.key)).toEqual(['codebuddy', 'QWEN', 'alpha']);
  });

  it('orders rows inside a group with the given comparator', () => {
    expect(groups[0]!.rows.map((r) => r.at)).toEqual([2, 1]);
  });
});

describe('relativeTime', () => {
  it('reads future and past in the largest whole unit', () => {
    expect(relativeTime('2026-11-06T12:00:00Z', NOW)).toBe('in 2 days');
    expect(relativeTime('2026-11-04T09:00:00Z', NOW)).toBe('3 hours ago');
    expect(relativeTime('2026-11-04T11:59:00Z', NOW)).toBe('1 minute ago');
    expect(relativeTime('2026-11-04T12:00:10Z', NOW)).toBe('just now');
  });
});
