import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ sql: [] as string[], params: [] as unknown[][] }));

vi.mock('pg', () => {
  class Pool {
    on() {}
    async connect() {
      return {
        query: async (sql: string, params: unknown[]) => {
          calls.sql.push(sql);
          calls.params.push(params);
          return { rows: [{ deleted: calls.sql.length === 1 ? 16 : 19 }] };
        },
        release: () => undefined,
      };
    }
  }
  return { Pool, default: { Pool } };
});

import { dbPruneGuests } from '../../src/server/db';

describe('guest cleanup (#439)', () => {
  beforeEach(() => {
    calls.sql.length = 0;
    calls.params.length = 0;
    process.env['DATABASE_URL'] = 'postgresql://x:y@localhost:1/z';
    process.env['OCTO_SERVICE_URL'] = 'postgresql://x:y@localhost:1/z';
  });

  it('deletes guest workspaces first, then guests, both only past the window', async () => {
    const result = await dbPruneGuests(7);
    expect(result).toEqual({ workspaces: 16, principals: 19 });
    expect(calls.sql).toHaveLength(2);
    expect(calls.sql[0]).toContain('DELETE FROM octo.workspaces');
    expect(calls.sql[1]).toContain('DELETE FROM octo.principals');
    expect(calls.params).toEqual([[7], [7]]);
  });

  it('leaves guest workspaces that hold files, a database or a recently used key', async () => {
    await dbPruneGuests();
    const workspaceDelete = calls.sql[0] ?? '';
    expect(workspaceDelete).toContain('p.is_guest AND w.auto_provisioned');
    expect(workspaceDelete).toContain('octo.files');
    expect(workspaceDelete).toContain('octo.workspace_databases');
    expect(workspaceDelete).toContain('octo.api_keys');
    expect(calls.sql[1]).toContain('NOT EXISTS (SELECT 1 FROM octo.workspaces');
  });
});
