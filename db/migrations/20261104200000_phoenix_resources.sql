-- Octo Schema: which workspace owns each Phoenix dataset, experiment and run (issue #47)
--
-- One Phoenix serves every workspace. Its traces are separated by project, but its
-- datasets, dataset versions, dataset examples, experiments and experiment runs are global: anyone
-- holding the id could read them. Octo therefore records, at creation, which
-- workspace made each one, and the otel dataset routes refuse any id that is not
-- recorded for the caller's workspace.
--
-- A row is (kind, Phoenix's id). An id belongs to one workspace, so the key is the
-- id alone within its kind. Rows are written only by the routes, as the workspace.

CREATE TABLE IF NOT EXISTS octo.phoenix_resources (
    kind TEXT NOT NULL CHECK (kind IN ('dataset', 'version', 'example', 'experiment', 'run')),
    phoenix_id TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES octo.workspaces(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (kind, phoenix_id)
);

CREATE INDEX IF NOT EXISTS phoenix_resources_workspace
    ON octo.phoenix_resources (workspace_id, kind);

ALTER TABLE octo.phoenix_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY phoenix_resources_select_member ON octo.phoenix_resources
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY phoenix_resources_insert_member ON octo.phoenix_resources
    FOR INSERT WITH CHECK (octo.is_workspace_member(workspace_id) = true);

DROP POLICY IF EXISTS tenant_scope_fence ON octo.phoenix_resources;
CREATE POLICY tenant_scope_fence ON octo.phoenix_resources
    AS RESTRICTIVE
    FOR ALL
    USING (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id())
    WITH CHECK (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id());
