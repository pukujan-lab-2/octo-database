/**
 * Keeps tests/e2e/route-table.ts in step with the code.
 *
 * route-isolation.spec.ts only covers routes that have a row, so a route added
 * without one would go untested. This reads every route matcher in src/routes
 * (and the OAuth routes in src/server/oauth.ts) and checks that some row matches
 * it. The other direction, every row being a live route, is checked by the e2e
 * spec itself.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_TABLE, concretePath } from '../e2e/route-table';

const ROOT = join(__dirname, '..', '..');
// static.ts serves the built frontend for any path; it has no route of its own.
const SOURCES = [
  ...readdirSync(join(ROOT, 'src/routes'))
    .filter((file) => file.endsWith('.ts') && file !== 'static.ts')
    .map((file) => `src/routes/${file}`),
  'src/server/oauth.ts',
];

const WS = '00000000-0000-4000-8000-000000000001';
const ID = '00000000-0000-4000-8000-000000000002';

const rows = (source: string) => ROUTE_TABLE.filter((spec) => spec.source === source);
const paths = (source: string) => rows(source).map((spec) => concretePath(spec, WS, ID));

describe('route table drift', () => {
  it('names only files that exist', () => {
    for (const spec of ROUTE_TABLE) expect(SOURCES, `${spec.method} ${spec.path}`).toContain(spec.source);
  });

  for (const source of SOURCES) {
    const text = readFileSync(join(ROOT, source), 'utf8');

    it(`${source}: every exact path and method has a row`, () => {
      const missing: string[] = [];
      for (const [, path, method] of Array.from(text.matchAll(/(?<![.\w])(?:pathname|path) === '([^']+)' && req\.method === '([A-Z]+)'/g))) {
        if (!rows(source).some((spec) => spec.path === path && spec.method === method)) missing.push(`${method} ${path}`);
      }
      for (const [, path] of Array.from(text.matchAll(/(?<![.\w])pathname === '([^']+)'(?! && req\.method)/g))) {
        if (!rows(source).some((spec) => spec.path === path)) missing.push(path!);
      }
      for (const [, path, method] of Array.from(text.matchAll(/pathname !== '([^']+)' \|\| req\.method !== '([A-Z]+)'/g))) {
        if (!rows(source).some((spec) => spec.path === path && spec.method === method)) missing.push(`${method} ${path}`);
      }
      expect(missing).toEqual([]);
    });

    it(`${source}: every path pattern matches a row`, () => {
      const missing: string[] = [];
      for (const [, pattern] of Array.from(text.matchAll(/\/(\^\\\/(?:api|public)[^\n]*?\$)\//g))) {
        const re = new RegExp(pattern!);
        if (!paths(source).some((path) => re.test(path))) missing.push(pattern!);
      }
      for (const [, prefix] of Array.from(text.matchAll(/(?:pathname|path)\.startsWith\('(\/[^']+)'\)/g))) {
        if (!paths(source).some((path) => path.startsWith(prefix!))) missing.push(`${prefix}…`);
      }
      for (const [, suffix] of Array.from(text.matchAll(/pathname\.endsWith\('(\/[^']+)'\)/g))) {
        if (!paths(source).some((path) => path.endsWith(suffix!))) missing.push(`…${suffix}`);
      }
      expect(missing).toEqual([]);
    });
  }
});
