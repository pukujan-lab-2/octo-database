# TLA+ models

Three small models of the parts of Octo where steps can interleave or fail
halfway. TLC checks every state they can reach, so a bad ordering shows up
even if no test ever hits it.

| Model | What it follows in the code |
|---|---|
| `WorkspaceProvisioning.tla` | Auto-provisioning and `POST /api/workspaces/:id/database`: check, `CREATE DATABASE`, record it. |
| `FileLifecycle.tla` | `archiveFile` and `restoreFile` in `src/storage/archive-service.ts`, the one-job-per-file queue, delete, worker crashes, and the on-demand restore a download runs. |
| `KeyRevocation.tla` | Key revocation against requests already in flight, and the confirm gate with its two-minute window. |

## Run

```bash
TLA2TOOLS=/path/to/tla2tools.jar verification/tla/check.sh
```

It needs Java 11 or newer and `tla2tools.jar` v1.7.4. CI downloads the jar,
checks its SHA-256 and runs the script inside the `gates` job.

## What each config expects

Exit 0 means TLC found no violation. Exit 12 means an invariant fails, which is
expected in five configs: three record behavior the code has today, and two are
controls that show the model can fail.

| Config | Expect | Why |
|---|---|---|
| `WorkspaceProvisioning` | 0 | At most one database is recorded per workspace, and the recorded one exists. |
| `WorkspaceProvisioningOrphan` | 12 | **Finding.** Two requests can both pass the check and both create a database. The loser's insert fails on the unique key and its database and role stay in the cluster. |
| `WorkspaceProvisioningCleanup` | 0 | Dropping the database on a lost insert would fix it. |
| `FileLifecycleNoHash` | 12 | Control: if a failed archive saved the Drive locator without `archive_hash`, as the code did before #429, a later restore could not check the Drive copy and would write it over the good R2 bytes. |
| `FileLifecycle` | 0 | With the hash saved wherever the locator is saved (#429), no file loses its last good copy, with crashes, failed calls, bad Drive bytes and on-demand restores. |
| `FileLifecycleJobsOnly` | 0 | With that fix and without on-demand restores, the state always says where the bytes are once nothing is running. |
| `FileLifecycleOnDemandRace` | 12 | **Finding.** An archive job that loaded the file as archived can delete the R2 copy a download just restored, and the file ends `active_r2` with no R2 bytes. Drive still has them, so nothing is lost, but downloads fail until a restore job runs. |
| `FileLifecycleNoVerify` | 12 | Control: if archive dropped R2 without verifying Drive, bytes would be lost. |
| `KeyRevocation` | 0 | A revoked key starts no request; a plain API key never passes the confirm gate; a session skips codes only inside the window after a pass. |
| `KeyRevocationInFlight` | 12 | **Finding.** A request that authenticated before the revoke still finishes its write afterwards. |

When code changes fix a finding, flip its expected exit in `check.sh` and this table.
