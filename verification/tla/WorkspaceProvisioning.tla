------------------------- MODULE WorkspaceProvisioning -------------------------
(***************************************************************************)
(* Giving one workspace its own Postgres database.                         *)
(*                                                                         *)
(* Two paths do this: autoProvisionWorkspaceDatabase right after the       *)
(* workspace is created (src/server/auto-provision.ts), and the manual     *)
(* POST /api/workspaces/:id/database route. Both run the same three steps: *)
(*   1. check: dbGetWorkspaceDatabase; stop if a database is recorded;     *)
(*   2. create: provisionDatabase runs CREATE DATABASE and CREATE ROLE     *)
(*      with a random suffix, so every request makes its own database;     *)
(*   3. insert: dbInsertWorkspaceDatabase records it. workspace_id is      *)
(*      UNIQUE, so only the first insert wins.                             *)
(* Any step may fail. Nothing locks the workspace between check and insert.*)
(***************************************************************************)
CONSTANTS
    Requests,           \* concurrent provisioning requests for one workspace
    CleanupOnConflict   \* a losing request drops the database it made (FALSE in the code)

VARIABLES
    pc,        \* each request's step
    cluster,   \* databases that exist in the cluster, named by the request that made them
    catalog    \* databases recorded in octo.workspace_databases

vars == <<pc, cluster, catalog>>

Init ==
    /\ pc = [r \in Requests |-> "check"]
    /\ cluster = {} /\ catalog = {}

Check(r) ==
    /\ pc[r] = "check"
    /\ pc' = [pc EXCEPT ![r] = IF catalog = {} THEN "create" ELSE "done"]
    /\ UNCHANGED <<cluster, catalog>>

Create(r) ==
    /\ pc[r] = "create"
    /\ \/ cluster' = cluster \cup {r} /\ pc' = [pc EXCEPT ![r] = "insert"]
       \/ pc' = [pc EXCEPT ![r] = "failed"] /\ UNCHANGED cluster
    /\ UNCHANGED catalog

Insert(r) ==
    /\ pc[r] = "insert"
    /\ IF catalog = {}
       THEN /\ catalog' = {r} /\ pc' = [pc EXCEPT ![r] = "done"]
            /\ UNCHANGED cluster
       ELSE /\ pc' = [pc EXCEPT ![r] = "failed"]         \* unique violation
            /\ cluster' = IF CleanupOnConflict THEN cluster \ {r} ELSE cluster
            /\ UNCHANGED catalog

Next == \E r \in Requests : Check(r) \/ Create(r) \/ Insert(r)

Spec == Init /\ [][Next]_vars

AtMostOneRecorded == \A a, b \in catalog : a = b

RecordedExists == catalog \subseteq cluster

Finished == \A r \in Requests : pc[r] \in {"done", "failed"}

\* When every request has finished, each database in the cluster is recorded.
NoOrphanAtRest == Finished => cluster \subseteq catalog

=============================================================================
