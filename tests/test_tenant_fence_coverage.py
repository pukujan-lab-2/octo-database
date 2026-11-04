"""Every tenant table keeps the workspace-scope fence.

Slice 14 put a RESTRICTIVE `tenant_scope_fence` policy on the tenant tables that
existed then, and its own test only checks that list. A table added later with a
`workspace_id` column and no fence leaves a workspace-scoped key able to read other
workspaces its principal belongs to (this happened to graph_projections, #77).

Static check on the migration SQL: every table created with a `workspace_id` column
must have a `tenant_scope_fence` policy, or be named below with the reason it does
not need one. Adding a table to EXEMPT is a decision; say why.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

MIGRATIONS = Path(__file__).parent.parent / "db" / "migrations"

# Tables with a workspace_id column that are deliberately not fenced.
EXEMPT = {
    # Owned by one principal and reachable only with a person's session; API keys,
    # including workspace-scoped ones, are refused on the vault routes.
    "vault_items": "scoped by owning principal; vault is session-only",
    "vault_grants": "scoped by owning principal; vault is session-only",
    # RLS on with no policy: the app role can read nothing, only the service role.
    "oauth_auth_codes": "no policy; app role denied, service role only",
    "oauth_refresh_tokens": "no policy; app role denied, service role only",
    "workspace_database_credentials": "no policy; app role denied, service role only",
}

CREATE_TABLE = re.compile(
    r"CREATE TABLE(?: IF NOT EXISTS)?\s+(?:octo\.)?\"?(\w+)\"?\s*\((.*?)\n\);",
    re.S | re.I,
)
FENCE_POLICY = re.compile(r"CREATE POLICY\s+tenant_scope_fence\s+ON\s+(?:octo\.)?\"?(\w+)\"?", re.I)
FENCE_ARRAY = re.compile(r"tenant_tables TEXT\[\]\s*:=\s*ARRAY\[(.*?)\];", re.S)


def read_migrations() -> tuple[set[str], set[str]]:
    """Returns (tables with a workspace_id column, tables with a fence policy)."""
    with_workspace: set[str] = set()
    fenced: set[str] = set()
    for path in sorted(MIGRATIONS.glob("*.sql")):
        sql = path.read_text(encoding="utf-8")
        for match in CREATE_TABLE.finditer(sql):
            if re.search(r"\bworkspace_id\b", match.group(2)):
                with_workspace.add(match.group(1))
        fenced.update(FENCE_POLICY.findall(sql))
        for match in FENCE_ARRAY.finditer(sql):
            fenced.update(re.findall(r"'(\w+)'", match.group(1)))
    return with_workspace, fenced


class TenantFenceCoverageTests(unittest.TestCase):
    def test_every_workspace_table_is_fenced_or_exempt(self) -> None:
        with_workspace, fenced = read_migrations()
        missing = sorted(with_workspace - fenced - set(EXEMPT))
        self.assertEqual(
            missing,
            [],
            f"tables with a workspace_id column and no tenant_scope_fence: {missing}. "
            "Add the fence in a migration, or add the table to EXEMPT with the reason.",
        )

    def test_exempt_tables_still_exist_and_are_still_unfenced(self) -> None:
        with_workspace, fenced = read_migrations()
        stale = sorted(name for name in EXEMPT if name not in with_workspace or name in fenced)
        self.assertEqual(stale, [], f"EXEMPT entries that no longer apply: {stale}")

    def test_graph_projections_is_fenced(self) -> None:
        _, fenced = read_migrations()
        self.assertIn("graph_projections", fenced)


if __name__ == "__main__":
    unittest.main()
