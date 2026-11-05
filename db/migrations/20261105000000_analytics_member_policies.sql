-- Octo Schema: member policies on the analytics catalog (issue #10)
--
-- The analytics tables (datasets, dataset_versions, analytics_specs,
-- analytics_schedules, analytics_results) had RLS on and only the restrictive
-- tenant_scope_fence, with no permissive policy. octo_app could read nothing in
-- them, so every analytics route ran on the BYPASSRLS service pool, and the
-- workspace boundary there rested on each query's own WHERE clause.
--
-- These policies let the request role reach a workspace's analytics rows only
-- when the caller is a member of that workspace, the same rule the analytics
-- routes apply (any member may read and write). The fence still narrows a
-- workspace-scoped key to its own workspace. The job worker and the schedule
-- tick have no caller and keep using octo_service.

CREATE POLICY datasets_select_member ON octo.datasets
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY datasets_insert_member ON octo.datasets
    FOR INSERT WITH CHECK (octo.is_workspace_member(workspace_id) = true);
-- Registration locks the dataset row (SELECT ... FOR UPDATE), which needs UPDATE.
CREATE POLICY datasets_update_member ON octo.datasets
    FOR UPDATE USING (octo.is_workspace_member(workspace_id) = true)
    WITH CHECK (octo.is_workspace_member(workspace_id) = true);

CREATE POLICY dataset_versions_select_member ON octo.dataset_versions
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY dataset_versions_insert_member ON octo.dataset_versions
    FOR INSERT WITH CHECK (octo.is_workspace_member(workspace_id) = true);

CREATE POLICY analytics_specs_select_member ON octo.analytics_specs
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY analytics_specs_insert_member ON octo.analytics_specs
    FOR INSERT WITH CHECK (octo.is_workspace_member(workspace_id) = true);

CREATE POLICY analytics_schedules_select_member ON octo.analytics_schedules
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY analytics_schedules_insert_member ON octo.analytics_schedules
    FOR INSERT WITH CHECK (octo.is_workspace_member(workspace_id) = true);
CREATE POLICY analytics_schedules_delete_member ON octo.analytics_schedules
    FOR DELETE USING (octo.is_workspace_member(workspace_id) = true);

-- Results are written by the worker; members only read them.
CREATE POLICY analytics_results_select_member ON octo.analytics_results
    FOR SELECT USING (octo.is_workspace_member(workspace_id) = true);

GRANT SELECT, INSERT, UPDATE ON octo.datasets TO octo_app;
GRANT SELECT, INSERT ON octo.dataset_versions TO octo_app;
GRANT SELECT, INSERT ON octo.analytics_specs TO octo_app;
GRANT SELECT, INSERT, DELETE ON octo.analytics_schedules TO octo_app;
GRANT SELECT ON octo.analytics_results TO octo_app;
