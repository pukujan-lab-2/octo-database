---------------------------- MODULE FileLifecycle ----------------------------
(***************************************************************************)
(* One file's bytes moving between R2 (active) and Google Drive (cold).    *)
(*                                                                         *)
(* Follows archiveFile and restoreFile in src/storage/archive-service.ts.  *)
(* The actors:                                                             *)
(*  - one archive or restore job at a time: lockIdleFile refuses a second  *)
(*    while one is queued or running, or while the file is archiving or    *)
(*    restoring;                                                           *)
(*  - the on-demand restore a download runs when an archived file has no   *)
(*    R2 bytes (ensureActiveBytes in src/server/present.ts). It calls      *)
(*    restoreFile directly and does not take part in that serialization;   *)
(*  - delete, allowed only while the file is idle;                         *)
(*  - a worker crash at any step, after which the job runs again from the  *)
(*    start with a fresh read of the file row.                             *)
(*                                                                         *)
(* Any network or storage call may fail. Drive may hold bytes that do not  *)
(* match the file ("bad"). Archive verifies the upload before it drops R2; *)
(* restore checks Drive against archive_hash, which only a successful      *)
(* archive records.                                                        *)
(***************************************************************************)
EXTENDS Naturals, Sequences

CONSTANTS
    OnDemand,      \* downloads restore on demand (TRUE in the code)
    VerifyFirst,   \* archive verifies the Drive copy before it may drop R2 (TRUE in the code)
    HashWithLocator, \* every update that records a Drive locator also records archive_hash (TRUE in the code, #429)
    MaxCrashes

VARIABLES
    state,    \* octo.files.archive_state, or "deleted" once the row is gone
    hashed,   \* octo.files.archive_hash is recorded
    r2,       \* what R2 holds: "none", "good" or "bad"
    drive,    \* what the recorded Drive locator holds: "none" (no locator), "good" or "bad"
    jpc,      \* the job's step; "idle" when no job is queued or running
    jkind,    \* "archive" or "restore"
    jrec,     \* the file state the job read when it started
    dpc,      \* the on-demand restore's step
    drec,     \* the file state the on-demand restore read
    jread,    \* the Drive bytes the restore job read
    dread,    \* the Drive bytes the on-demand restore read
    crashes

vars == <<state, hashed, r2, drive, jpc, jkind, jrec, dpc, drec, jread, dread, crashes>>

Init ==
    /\ state = "active_r2" /\ hashed = FALSE /\ r2 = "good" /\ drive = "none"
    /\ jpc = "idle" /\ jkind = "archive" /\ jrec = "active_r2"
    /\ dpc = "idle" /\ drec = "active_r2" /\ crashes = 0
    /\ jread = "none" /\ dread = "none"

\* Updating a deleted row changes nothing.
Set(s) == state' = IF state = "deleted" THEN "deleted" ELSE s

Idle == jpc = "idle" /\ state \notin {"archiving", "restoring", "deleted"}

-----------------------------------------------------------------------------
(* Queue, worker and delete *)

Enqueue(kind) ==
    /\ Idle
    /\ jpc' = "load" /\ jkind' = kind
    /\ UNCHANGED <<state, hashed, r2, drive, jrec, dpc, drec, jread, dread, crashes>>

Delete ==
    /\ Idle
    /\ state' = "deleted" /\ r2' = "none"
    /\ UNCHANGED <<hashed, drive, jpc, jkind, jrec, dpc, drec, jread, dread, crashes>>

Load ==
    /\ jpc = "load"
    /\ jrec' = state
    /\ jpc' = IF state = "deleted" THEN "idle"
              ELSE IF jkind = "archive" THEN "a_start" ELSE "r_start"
    /\ UNCHANGED <<state, hashed, r2, drive, jkind, dpc, drec, jread, dread, crashes>>

Crash ==
    /\ jpc \notin {"idle", "load"}
    /\ crashes < MaxCrashes
    /\ jpc' = "load" /\ crashes' = crashes + 1
    /\ UNCHANGED <<state, hashed, r2, drive, jkind, jrec, dpc, drec, jread, dread>>

-----------------------------------------------------------------------------
(* archiveFile. Its hash is taken from the R2 bytes it reads, so a check  *)
(* passes when Drive holds the same bytes as R2.                           *)

Matches == drive # "none" /\ drive = r2

ArchiveStep ==
    /\ \/ /\ jpc = "a_start"
          /\ IF jrec = "archived_drive" /\ drive # "none" /\ r2 # "none" /\ Matches
             THEN r2' = "none" /\ jpc' = "idle"           \* cold copy verifies: prune R2
             ELSE IF jrec = "archived_drive" /\ drive # "none" /\ r2 = "none"
             THEN jpc' = "idle" /\ UNCHANGED r2           \* already archived
             ELSE IF r2 = "none"
             THEN jpc' = "idle" /\ UNCHANGED r2           \* ACTIVE_READ_FAILED
             ELSE jpc' = "a_upload" /\ UNCHANGED r2
          /\ IF jpc' = "a_upload" THEN Set("archiving") ELSE UNCHANGED state
          /\ UNCHANGED <<hashed, drive>>
       \/ /\ jpc = "a_upload"
          /\ \/ Set("active_r2") /\ jpc' = "idle" /\ UNCHANGED drive    \* upload failed
             \/ drive' \in {r2, "bad"} /\ jpc' = "a_verify" /\ UNCHANGED state
          /\ UNCHANGED <<hashed, r2>>
       \/ /\ jpc = "a_verify"
          /\ IF VerifyFirst /\ ~Matches
             THEN /\ Set("reconciliation_required") /\ jpc' = "idle"  \* the locator is recorded
                  /\ hashed' = (hashed \/ HashWithLocator)
             ELSE jpc' = "a_persist" /\ UNCHANGED <<state, hashed>>
          /\ UNCHANGED <<r2, drive>>
       \/ /\ jpc = "a_persist"
          /\ \/ Set("archived_drive") /\ hashed' = TRUE /\ jpc' = "a_prune"
             \/ /\ Set("reconciliation_required") /\ jpc' = "idle"  \* the locator is recorded
                /\ hashed' = (hashed \/ HashWithLocator)
          /\ UNCHANGED <<r2, drive>>
       \/ /\ jpc = "a_prune"
          /\ r2' \in {"none", r2}             \* a failed delete is left for a re-run
          /\ jpc' = "idle"
          /\ UNCHANGED <<state, hashed, drive>>
    /\ UNCHANGED <<jkind, jrec, dpc, drec, jread, dread, crashes>>

-----------------------------------------------------------------------------
(* restoreFile, run by the restore job (pc jpc, steps "r_") and by the     *)
(* on-demand restore (pc dpc, steps "d_"). p is the step prefix.           *)

Restore(pc, pcNext, rec, read, readNext, p) ==
    \/ /\ pc = p \o "start"
       /\ readNext = read
       /\ IF (rec = "active_r2" /\ r2 # "none") \/ drive = "none"
          THEN pcNext = "idle" /\ UNCHANGED state         \* already active, or no locator
          ELSE pcNext = p \o "read" /\ Set("restoring")
       /\ UNCHANGED r2
    \/ /\ pc = p \o "read"
       /\ readNext = drive
       /\ \/ Set("archived_drive") /\ pcNext = "idle"     \* ARCHIVE_READ_FAILED
          \/ /\ drive = "bad" /\ hashed
             /\ Set("reconciliation_required") /\ pcNext = "idle"   \* ARCHIVE_HASH_MISMATCH
          \/ /\ ~(drive = "bad" /\ hashed)
             /\ pcNext = p \o "write" /\ UNCHANGED state
       /\ UNCHANGED r2
    \/ /\ pc = p \o "write"
       /\ readNext = read
       /\ \/ Set("archived_drive") /\ pcNext = "idle" /\ UNCHANGED r2   \* RESTORE_WRITE_FAILED
          \/ r2' = read /\ pcNext = p \o "persist" /\ UNCHANGED state
          \/ r2' = read /\ Set("reconciliation_required") /\ pcNext = "idle"  \* RESTORE_VERIFY_FAILED
    \/ /\ pc = p \o "persist"
       /\ readNext = read
       /\ \/ Set("active_r2") /\ pcNext = "idle"          \* the Drive copy is kept
          \/ Set("reconciliation_required") /\ pcNext = "idle"
       /\ UNCHANGED r2

RestoreJob ==
    /\ Restore(jpc, jpc', jrec, jread, jread', "r_")
    /\ UNCHANGED <<hashed, drive, jkind, jrec, dpc, drec, dread, crashes>>

\* A download finds no R2 bytes for an archived file and restores it in-line.
OnDemandStart ==
    /\ OnDemand /\ dpc = "idle"
    /\ state = "archived_drive" /\ r2 = "none"
    /\ dpc' = "d_start" /\ drec' = state
    /\ UNCHANGED <<state, hashed, r2, drive, jpc, jkind, jrec, jread, dread, crashes>>

OnDemandStep ==
    /\ Restore(dpc, dpc', drec, dread, dread', "d_")
    /\ UNCHANGED <<hashed, drive, jpc, jkind, jrec, drec, jread, crashes>>

-----------------------------------------------------------------------------

Next ==
    \/ Enqueue("archive") \/ Enqueue("restore") \/ Delete
    \/ Load \/ Crash \/ ArchiveStep \/ RestoreJob
    \/ OnDemandStart \/ OnDemandStep

Spec == Init /\ [][Next]_vars

TypeOK ==
    /\ state \in {"active_r2", "archiving", "archived_drive", "restoring",
                  "reconciliation_required", "deleted"}
    /\ hashed \in BOOLEAN
    /\ r2 \in {"none", "good", "bad"} /\ drive \in {"none", "good", "bad"}
    /\ crashes \in 0..MaxCrashes

\* A live file always has a good copy somewhere.
NoLoss == state # "deleted" => (r2 = "good" \/ drive = "good")

Quiet == jpc = "idle" /\ dpc = "idle"

\* Once nothing is running, the state says where good bytes are.
ReadableAtRest ==
    Quiet => /\ (state = "active_r2" => r2 = "good")
             /\ (state = "archived_drive" => (r2 = "good" \/ drive = "good"))

=============================================================================
