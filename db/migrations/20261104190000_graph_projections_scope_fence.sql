-- Octo Schema: workspace-scope fence for graph_projections (issue #77)
--
-- graph_projections (slice 10) has row-level security and member policies but was
-- never given the restrictive tenant_scope_fence that slice 14 put on every other
-- tenant table. A key scoped to one workspace could therefore read, and an operator
-- could update, the projection row of another workspace its principal belongs to.
--
-- RESTRICTIVE policies are AND-combined with the existing PERMISSIVE ones, so this
-- only narrows access. With no workspace scope set the policy is inert, so unscoped
-- sessions and the BYPASSRLS service role behave as before.

ALTER TABLE octo.graph_projections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_scope_fence ON octo.graph_projections;
CREATE POLICY tenant_scope_fence ON octo.graph_projections
    AS RESTRICTIVE
    FOR ALL
    USING (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id())
    WITH CHECK (octo.current_workspace_id() IS NULL OR workspace_id = octo.current_workspace_id());
