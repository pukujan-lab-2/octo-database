-- Octo Schema: workspace members added by email before they have signed in (issue #82)
--
-- A workspace owner or admin adds a member by Google email. When that email already
-- belongs to a principal, the membership is written at once. When nobody has signed
-- in with it yet, the addition waits here and becomes a membership the first time a
-- Google sign-in with that verified email completes (src/routes/auth.ts).
--
-- Only the server touches this table: RLS is on with no policy, so the app role
-- reads nothing and the service role does all the work.

CREATE TABLE IF NOT EXISTS octo.workspace_invites (
    workspace_id UUID NOT NULL REFERENCES octo.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email = lower(email)),
    role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'member')),
    invited_by UUID REFERENCES octo.principals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, email)
);

CREATE INDEX IF NOT EXISTS workspace_invites_email ON octo.workspace_invites (email);

ALTER TABLE octo.workspace_invites ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON octo.workspace_invites TO octo_service;
